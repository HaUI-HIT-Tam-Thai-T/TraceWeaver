import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReconstructionController } from '../src/features/reconstruction/state/controller.ts'
import { ApiError } from '../src/services/apiError.ts'
import { runFormDefaults, toRunBody } from '../src/features/reconstruction/form.ts'
import { event, scope, EID, EID2 } from './event-fixtures.mjs'
import { run, graph } from './reconstruction-fixtures.mjs'

const LID=graph().links[0].id
const reviewBody=(decision='accepted',version=1)=>({decision,reason:'checked',expected_version:version})
const manualBody=()=>({from_event_id:EID,to_event_id:EID2,reason:'checked'})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise}}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
const fail=(code,status=409)=>new ApiError({kind:status===401?'auth':'http',code,status,message:'Safe failure',requestId:'request-id'})
async function setup(overrides={}) {
  let currentGraph=graph(),gets=0,rechecks=0
  const calls=[]
  const controller=createReconstructionController({
    service:{createRun:async()=>run(),getRun:async()=>run(),getGraph:async()=>{gets++;return overrides.getGraph?overrides.getGraph(gets,currentGraph):structuredClone(currentGraph)}},
    linkService:{
      reviewLink:async(...args)=>{calls.push(['review',...args]);if(overrides.reviewLink)return overrides.reviewLink(...args);currentGraph.links[0]={...currentGraph.links[0],review_state:args[3].decision,version:args[3].expected_version+1};currentGraph.version++;return {}},
      createManualLink:async(...args)=>{calls.push(['manual',...args]);if(overrides.createManualLink)return overrides.createManualLink(...args);currentGraph.links=[{...graph().links[0],method:'manual'}];currentGraph.version++;return {}},
    }, getEvent:async()=>event(),revalidate:async()=>{rechecks++},newKey:()=> 'key',
  })
  const access=scope(),root=event();controller.sync(access,root)
  await controller.create(toRunBody(runFormDefaults(root),root))
  return {controller,calls,access,root,gets:()=>gets,rechecks:()=>rechecks,setGraph:g=>{currentGraph=g}}
}
test('accept/reject/reaccept use each fresh Link.version, refetch graph and do not use Graph.version', async()=>{
  const x=await setup(); let version=1
  const unrelatedRevision=graph();unrelatedRevision.version=42;x.setGraph(unrelatedRevision);await x.controller.loadGraph()
  for(const decision of ['accepted','rejected','accepted']) {
    await x.controller.reviewLink(LID,reviewBody(decision,version))
    assert.equal(x.calls.at(-1)[4].expected_version,version)
    assert.equal(x.controller.getSnapshot().graph.links[0].review_state,decision)
    assert.equal(x.controller.getSnapshot().graph.links[0].version,++version)
  }
  assert.equal(x.gets(),5);assert.equal(x.controller.getSnapshot().mutation.status,'success')
})
test('stale Link.version and invalid reason/link cannot POST; duplicate including rejected refetches only', async()=>{
  const x=await setup()
  await x.controller.reviewLink(LID,reviewBody('accepted',99));assert.equal(x.calls.length,0);assert.equal(x.controller.getSnapshot().mutation.status,'conflict')
  await x.controller.reviewLink(LID,{...reviewBody(),reason:'  '});assert.equal(x.calls.length,0)
  await x.controller.reviewLink(EID,reviewBody());assert.equal(x.calls.length,0)
  const g=graph();g.links[0].review_state='rejected';x.setGraph(g);await x.controller.loadGraph()
  await x.controller.createManualLink(manualBody());assert.equal(x.calls.length,0);assert.equal(x.controller.getSnapshot().mutation.status,'duplicate')
})
test('manual must use graph nodes, different IDs and creates pending link only after refetch', async()=>{
  const x=await setup();const g=graph();g.links=[];x.setGraph(g);await x.controller.loadGraph()
  await x.controller.createManualLink({...manualBody(),to_event_id:EID});assert.equal(x.calls.length,0)
  await x.controller.createManualLink({...manualBody(),to_event_id:run().id});assert.equal(x.calls.length,0)
  await x.controller.createManualLink(manualBody());assert.equal(x.calls.length,1)
  assert.equal(x.controller.getSnapshot().graph.links[0].review_state,'pending');assert.equal(x.controller.getSnapshot().graph.links[0].method,'manual')
})
test('double submit and graph reload during POST cannot overlap; no optimistic change', async()=>{
  const d=deferred();const x=await setup({reviewLink:()=>d.promise})
  const task=x.controller.reviewLink(LID,reviewBody());await tick()
  assert.equal(x.controller.getSnapshot().graph.links[0].review_state,'pending')
  await x.controller.reviewLink(LID,reviewBody());await x.controller.createManualLink(manualBody());await x.controller.loadGraph()
  assert.equal(x.calls.length,1);assert.equal(x.gets(),1)
  d.resolve({});await task;assert.equal(x.gets(),2)
})
test('timeout/network/5xx/malformed POST refetch once without replay and remain uncertain', async()=>{
  for(const error of [new ApiError({kind:'timeout',code:'TIMEOUT',message:'Safe'}),new ApiError({kind:'network',code:'NETWORK_ERROR',message:'Safe'}),fail('HTTP_503',503),new ApiError({kind:'client',code:'INVALID_API_RESPONSE',message:'Safe'})]) {
    const x=await setup({reviewLink:async()=>{throw error}})
    await x.controller.reviewLink(LID,reviewBody())
    assert.equal(x.calls.length,1);assert.equal(x.gets(),2);assert.equal(x.controller.getSnapshot().mutation.status,'uncertain')
  }
})
test('committed POST plus failed GET remains success, graph locked; retry is GET only', async()=>{
  const x=await setup({getGraph:(n,g)=>{if(n===2)throw fail('HTTP_503',503);return structuredClone(g)}})
  await x.controller.reviewLink(LID,reviewBody())
  assert.equal(x.controller.getSnapshot().mutation.status,'success');assert.equal(x.controller.getSnapshot().graphStatus,'error')
  await x.controller.reviewLink(LID,reviewBody());assert.equal(x.calls.length,1)
  await x.controller.loadGraph();assert.equal(x.calls.length,1);assert.equal(x.gets(),3)
})
test('conflict and duplicate refetch; cycle/self error preserve graph without retries', async()=>{
  for(const [code,status] of [['VERSION_CONFLICT',409],['LINK_EXISTS',409],['SELF_LINK',422],['LINK_CYCLE',422]]) {
    const x=await setup({reviewLink:async()=>{throw fail(code,status)}})
    await x.controller.reviewLink(LID,reviewBody())
    assert.equal(x.calls.length,1);assert.equal(x.gets(),code==='VERSION_CONFLICT'||code==='LINK_EXISTS'?2:1)
    assert.equal(x.controller.getSnapshot().mutation.error.code,code)
  }
})
test('closed case locks all mutation through refetch; explicit probe sends nothing and BE can relock', async()=>{
  const x=await setup({reviewLink:async()=>{throw fail('CASE_CLOSED')}})
  await x.controller.reviewLink(LID,reviewBody());assert.ok(x.controller.getSnapshot().caseLocked)
  await x.controller.loadGraph();assert.ok(x.controller.getSnapshot().caseLocked)
  await x.controller.reviewLink(LID,reviewBody());await x.controller.createManualLink(manualBody());assert.equal(x.calls.length,1)
  x.controller.probeClosedCase();assert.equal(x.calls.length,1);assert.equal(x.controller.getSnapshot().caseLocked,false)
  await x.controller.reviewLink(LID,reviewBody());assert.equal(x.calls.length,2);assert.ok(x.controller.getSnapshot().caseLocked)
})
test('401/403/404 purge graph/drafts state and revalidate once without mutation replay', async()=>{
  for(const status of [401,403,404]) {
    const x=await setup({reviewLink:async()=>{throw fail(`HTTP_${status}`,status)}})
    await x.controller.reviewLink(LID,reviewBody());await x.controller.reviewLink(LID,reviewBody())
    assert.equal(x.controller.getSnapshot().graph,null);assert.equal(x.controller.getSnapshot().run,null)
    assert.equal(x.rechecks(),status===401?0:1);assert.equal(x.calls.length,1)
  }
})
test('scope reset aborts POST and stale completion cannot refetch or restore success', async()=>{
  const d=deferred();let signal
  const x=await setup({reviewLink:async(...args)=>{signal=args[4];return d.promise}})
  const task=x.controller.reviewLink(LID,reviewBody());await tick();x.controller.sync(scope(),event(EID2));assert.ok(signal.aborted)
  d.resolve({});await task;assert.equal(x.controller.getSnapshot().mutation.status,'idle');assert.equal(x.gets(),1)
})
test('scope reset during post-mutation refetch ignores stale graph; readonly cannot mutate', async()=>{
  const d=deferred();const x=await setup({getGraph:(n,g)=>n===2?d.promise:structuredClone(g)})
  const task=x.controller.reviewLink(LID,reviewBody());await tick();x.controller.stop();d.resolve(graph());await task
  assert.equal(x.controller.getSnapshot().graph,null);assert.equal(x.controller.getSnapshot().mutation.status,'idle')
  x.controller.sync(scope(false),event());await x.controller.reviewLink(LID,reviewBody());assert.equal(x.calls.length,1)
})
