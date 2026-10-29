import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCasesController } from '../src/features/cases/state/controller.ts'
import { ApiError } from '../src/services/apiError.ts'
import { caseDetail, CID, CID2 } from './case-fixtures.mjs'
import { scope, EID, EID2 } from './event-fixtures.mjs'
import { graph, RID } from './reconstruction-fixtures.mjs'

const note=()=>({kind:'note',event_ids:[],note:'  handling note\n '})
const events=()=>({kind:'events',event_ids:[EID],note:''})
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve()}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}}
const fail=(code,status=422)=>new ApiError({kind:status===401?'auth':'http',code,status,message:'Safe',requestId:'req-evidence'})
async function setup(overrides={}) {
  const calls=[];let reads=0,graphs=0,rechecks=0
  let detail=caseDetail()
  const service={listCases:async()=>({items:[],next_cursor:null}),getCase:async(...args)=>{reads++;return overrides.getCase?overrides.getCase(reads,detail,...args):structuredClone(detail)}}
  const controller=createCasesController(service,async()=>{rechecks++},{
    getGraph:async(...args)=>{graphs++;return overrides.getGraph?overrides.getGraph(...args):graph()},
    addEvidence:async(...args)=>{calls.push(args);if(overrides.addEvidence)return overrides.addEvidence(...args);const item={...caseDetail().evidence[0],id:'99999999-9999-4999-8999-999999999998',...args[2]};detail={...detail,evidence:[...detail.evidence,item]};return item},
  })
  const access=scope(),view={kind:'detail',caseId:CID,search:''}
  controller.sync(access,view);await tick()
  return{controller,calls,access,view,reads:()=>reads,graphs:()=>graphs,rechecks:()=>rechecks,setDetail:d=>{detail=d}}
}
test('note does not load graph, POST refetches detail without optimistic evidence or incrementing Case.version',async()=>{
  const d=deferred(),x=await setup({addEvidence:()=>d.promise})
  const before=x.controller.getSnapshot().detail.data
  const task=x.controller.submitEvidence(note());await tick()
  assert.equal(x.graphs(),0);assert.equal(x.controller.getSnapshot().detail.data,before)
  assert.equal(before.case.version,1);assert.equal(before.evidence.length,1)
  d.resolve(caseDetail().evidence[0]);await task
  assert.equal(x.reads(),2);assert.equal(x.controller.getSnapshot().detail.data.case.version,1)
  assert.equal(x.controller.getSnapshot().evidenceMutation.status,'success')
})
test('events lazily load exact case run graph, reject IDs outside snapshot and note hidden refs',async()=>{
  const x=await setup();assert.equal(x.graphs(),0)
  await x.controller.submitEvidence(events());assert.equal(x.calls.length,0)
  await x.controller.loadEvidenceSnapshot();assert.equal(x.graphs(),1)
  await x.controller.submitEvidence({...events(),event_ids:[CID2]});assert.equal(x.calls.length,0)
  await x.controller.submitEvidence({...note(),event_ids:[EID]});assert.equal(x.calls.length,0)
  await x.controller.submitEvidence(events());assert.equal(x.calls.length,1);assert.equal(x.calls[0][2].kind,'events')
  await x.controller.loadEvidenceSnapshot();assert.equal(x.graphs(),1)
  const y=await setup({getGraph:async()=>({...graph(),run_id:CID2})});await y.controller.loadEvidenceSnapshot();assert.equal(y.controller.getSnapshot().snapshot.status,'error')
})
test('snapshot network error allows note; closed case and readonly scope can read snapshot but cannot post',async()=>{
  const x=await setup({getGraph:async()=>{throw fail('HTTP_503',503)}});await x.controller.loadEvidenceSnapshot();await x.controller.submitEvidence(note());assert.equal(x.calls.length,1)
  const y=await setup();y.controller.sync({...y.access,canWrite:false},y.view);await tick();await y.controller.submitEvidence(note());await y.controller.loadEvidenceSnapshot();assert.equal(y.calls.length,0);assert.equal(y.graphs(),1)
  const z=await setup();const closed=caseDetail();closed.case.state='closed';z.setDetail(closed);await z.controller.refresh();await z.controller.submitEvidence(note());assert.equal(z.calls.length,0)
})
test('double submit and manual refresh cannot overlap mutation',async()=>{
  const d=deferred(),x=await setup({addEvidence:()=>d.promise})
  const task=x.controller.submitEvidence(note());await tick();await x.controller.submitEvidence(note());await x.controller.refresh()
  assert.equal(x.calls.length,1);assert.equal(x.reads(),1)
  d.resolve(caseDetail().evidence[0]);await task;assert.equal(x.reads(),2)
})
test('timeout/network/5xx/schema uncertainty GETs once and requires explicit new operation, even with matching evidence',async()=>{
  for(const error of [new ApiError({kind:'timeout',code:'TIMEOUT',message:'Safe'}),new ApiError({kind:'network',code:'NETWORK_ERROR',message:'Safe'}),fail('HTTP_503',503),new ApiError({kind:'client',code:'INVALID_API_RESPONSE',message:'Safe'})]) {
    const x=await setup({addEvidence:async()=>{throw error}})
    await x.controller.submitEvidence(note());assert.equal(x.calls.length,1);assert.equal(x.reads(),2)
    assert.equal(x.controller.getSnapshot().evidenceMutation.status,'uncertain')
    await x.controller.submitEvidence(note());assert.equal(x.calls.length,1)
    x.controller.beginNewEvidence();await x.controller.submitEvidence(note());assert.equal(x.calls.length,2)
  }
})
test('GET failure after success/uncertainty retains detail binding so form stays mounted; retry is GET only',async()=>{
  for(const uncertain of [false,true]) {
    const x=await setup({getCase:(n,d)=>{if(n===2)throw fail('HTTP_503',503);return structuredClone(d)},...(uncertain?{addEvidence:async()=>{throw new ApiError({kind:'timeout',code:'TIMEOUT',message:'Safe'})}}:{})})
    await x.controller.submitEvidence(note())
    assert.equal(x.controller.getSnapshot().evidenceMutation.status,uncertain?'uncertain':'success')
    assert.equal(x.controller.getSnapshot().detail.status,'error');assert.equal(x.controller.getSnapshot().detail.data.case.id,CID)
    x.controller.beginNewEvidence();await x.controller.submitEvidence(note());assert.equal(x.calls.length,1)
    await x.controller.refresh();assert.equal(x.calls.length,1);assert.equal(x.reads(),3);assert.equal(x.controller.getSnapshot().detail.status,'ready')
  }
})
test('manual detail refresh also retains form binding and snapshot when an unsent draft exists',async()=>{
  const x=await setup({getCase:(n,d)=>{if(n===2)throw fail('HTTP_503',503);return structuredClone(d)}})
  await x.controller.loadEvidenceSnapshot();await x.controller.refresh()
  assert.equal(x.controller.getSnapshot().detail.data.case.id,CID)
  assert.equal(x.controller.getSnapshot().snapshot.status,'ready');assert.equal(x.calls.length,0)
  await x.controller.refresh();assert.equal(x.controller.getSnapshot().detail.status,'ready');assert.equal(x.calls.length,0)
})
test('CASE_CLOSED locks and refetches; 422 preserves draft workflow without implicit read/version changes',async()=>{
  const x=await setup({addEvidence:async()=>{throw fail('CASE_CLOSED',409)}})
  await x.controller.submitEvidence(note());assert.equal(x.reads(),2);assert.equal(x.controller.getSnapshot().evidenceMutation.status,'locked')
  await x.controller.submitEvidence(note());assert.equal(x.calls.length,1)
  const y=await setup({addEvidence:async()=>{throw fail('INVALID_CASE_INPUT')}})
  await y.controller.submitEvidence(note());assert.equal(y.reads(),1);assert.equal(y.controller.getSnapshot().detail.data.case.version,1)
})
test('401/403/404 in POST or picker purge artifacts and revalidate once',async()=>{
  for(const stage of ['post','snapshot'])for(const status of [401,403,404]) {
    const error=fail(`HTTP_${status}`,status)
    const x=await setup(stage==='post'?{addEvidence:async()=>{throw error}}:{getGraph:async()=>{throw error}})
    if(stage==='post')await x.controller.submitEvidence(note());else await x.controller.loadEvidenceSnapshot()
    assert.equal(x.controller.getSnapshot().detail.data,null);assert.deepEqual(x.controller.getSnapshot().snapshot.events,[])
    assert.equal(x.rechecks(),status===401?0:1)
  }
})
test('scope/route change cancels stale graph and POST completion cannot refetch or restore success',async()=>{
  const d=deferred(),x=await setup({getGraph:()=>d.promise});const loading=x.controller.loadEvidenceSnapshot();await tick();x.controller.stop();d.resolve(graph());await loading
  assert.equal(x.controller.getSnapshot().snapshot.events.length,0)
  const p=deferred();let signal
  const y=await setup({addEvidence:async(_wid,_cid,_body,s)=>{signal=s;return p.promise}})
  const posting=y.controller.submitEvidence(note());await tick();y.controller.sync({...y.access,accessKey:{}},{kind:'detail',caseId:CID2,search:''});assert.ok(signal.aborted)
  p.resolve(caseDetail().evidence[0]);await posting;assert.equal(y.controller.getSnapshot().evidenceMutation.status,'idle')
})
test('concurrent workflow version comes only from refetched detail and changed run clears snapshot',async()=>{
  const x=await setup({getCase:(n,d)=>({...structuredClone(d),case:{...d.case,version:n===1?1:7,run_id:n===1?RID:EID2}})})
  await x.controller.loadEvidenceSnapshot();await x.controller.submitEvidence(note())
  assert.equal(x.controller.getSnapshot().detail.data.case.version,7);assert.equal(x.controller.getSnapshot().snapshot.status,'idle')
})
