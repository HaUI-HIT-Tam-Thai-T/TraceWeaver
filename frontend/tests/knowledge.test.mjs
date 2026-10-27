import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { createKnowledgeService } from '../src/features/knowledge/createKnowledgeService.ts'
import { createKnowledgeController, initialKnowledgeState, knowledgeReducer } from '../src/features/knowledge/controller.ts'
import { readKnowledgeQuery, writeKnowledgeQuery, knowledgeFormSchema } from '../src/features/knowledge/query.ts'
import { ApiError } from '../src/services/apiError.ts'
import { WID, scope } from './event-fixtures.mjs'
const id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const article=()=>({id,workspace_id:WID,title:'<script>title</script>',body:'<img src=x>\nBody',version:3,author_subject:'user-a',source_ref:'urn:traceweaver:knowledge:sample',created_at:'2026-10-27T07:00:00.000001Z'})
const page=(cursor=null)=>({items:[article()],next_cursor:cursor})
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{resolve,promise}}
const fail=(code,status)=>new ApiError({kind:status===401?'auth':status?'http':'network',code,status,message:'Safe',requestId:'req-knowledge'})
async function setup(list=async()=>page()){
 const calls=[];let rechecks=0
 const controller=createKnowledgeController({listKnowledge:async(...args)=>{calls.push(args);return list(...args)}},async()=>{rechecks++})
 const access=scope();controller.sync(access,'');await tick()
 return{controller,access,calls,rechecks:()=>rechecks}
}
test('knowledge query preserves literal text and URL escaping; validates duplicates, q bounds and limits',()=>{
 const filters={q:' a%_& Tiếng Việt ',limit:25}
 assert.deepEqual(readKnowledgeQuery('?'+writeKnowledgeQuery(filters)).filters,filters)
 assert.deepEqual(readKnowledgeQuery('').filters,{limit:50})
 for(const query of ['?q=','?q=a&q=b','?limit=25&limit=50','?limit=101','?limit=10','?q='+ 'x'.repeat(501)])assert.equal(readKnowledgeQuery(query).success,false)
 assert.ok(knowledgeFormSchema.safeParse({q:'',limit:'50'}).success)
})
test('GET-only service validates scope/DTO, sends encoded q/cursor/signal and keeps version/URI/UTC precision',async()=>{
 const calls=[];const client={get:async(...args)=>{calls.push(args);return{data:page()}}}
 const s=createKnowledgeService(client),signal=new AbortController().signal
 const result=await s.listKnowledge(WID,{q:'%_ &',limit:25},{cursor:'opaque+/=',signal})
 assert.equal(calls[0][0],`/api/v1/workspaces/${WID}/knowledge`);assert.deepEqual(Object.fromEntries(calls[0][1].params),{limit:'25',q:'%_ &',cursor:'opaque+/='});assert.equal(calls[0][1].signal,signal)
 assert.equal(result.items[0].version,3);assert.equal(result.items[0].source_ref,'urn:traceweaver:knowledge:sample');assert.equal(result.items[0].created_at,article().created_at)
 await s.listKnowledge(WID);assert.deepEqual(Object.fromEntries(calls[1][1].params),{limit:'50'})
 await assert.rejects(s.listKnowledge('bad'),{code:'INVALID_KNOWLEDGE_INPUT'})
 for(const data of ['<html>secret</html>',{...page(),items:[{...article(),version:0}]},{...page(),items:[{...article(),source_ref:'relative/path'}]},{...page(),items:[{...article(),workspace_id:id}]},{...page(),items:[article(),article()]}]){
 const svc=createKnowledgeService({get:async()=>({data})});await assert.rejects(svc.listKnowledge(WID),{code:'INVALID_API_RESPONSE'})
 }
})
test('cursor previous/next refetch exact filters without caching payload; refresh and search reset history',async()=>{
 const x=await setup(async(w,f,o)=>o.cursor?{items:[],next_cursor:null}:page('next'))
 await x.controller.nextPage();assert.equal(x.calls[1][2].cursor,'next');assert.equal(x.controller.getSnapshot().index,1);assert.deepEqual(x.controller.getSnapshot().items,[])
 await x.controller.nextPage();assert.equal(x.calls.length,2)
 await x.controller.previousPage();assert.equal(x.calls[2][2].cursor,undefined)
 x.controller.sync(x.access,'q=Other&limit=25');await tick();assert.deepEqual(x.calls[3][1],{q:'Other',limit:25});assert.equal(x.controller.getSnapshot().index,0)
 await x.controller.refresh();assert.deepEqual(x.controller.getSnapshot().cursors,[null])
})
test('late results after search/scope/stop cannot restore old data even if adapter ignores abort',async()=>{
 const pending=defer();const x=await setup(async(w,f)=>f.q==='old'?pending.promise:page())
 x.controller.sync(x.access,'q=old');await tick();const signal=x.calls.at(-1)[2].signal
 x.controller.sync(x.access,'q=new');await tick();pending.resolve({items:[{...article(),title:'STALE'}],next_cursor:'stale'});await tick()
 assert.ok(signal.aborted);assert.notEqual(x.controller.getSnapshot().items[0].title,'STALE')
 const p=defer();const y=await setup(()=>p.promise);y.controller.stop();p.resolve(page());await tick();assert.deepEqual(y.controller.getSnapshot(),initialKnowledgeState())
})
test('401/403/404 purge articles and latch denial through access revalidation without loops',async()=>{
 for(const status of [401,403,404]){
 const x=await setup(async()=>{throw fail('HTTP_'+status,status)})
 assert.equal(x.controller.getSnapshot().status,status===401?'reauth':'blocked');assert.equal(x.rechecks(),status===401?0:1)
 x.controller.sync(null,'');x.controller.sync({...x.access,accessKey:{}},'');await tick();assert.equal(x.calls.length,1);assert.deepEqual(x.controller.getSnapshot().items,[])
 await x.controller.nextPage();assert.equal(x.calls.length,1)
 }
})
test('INVALID_CURSOR waits for manual restart; repeated cursor is rejected without auto looping',async()=>{
 let count=0;const x=await setup(async()=>{if(++count===2)throw fail('INVALID_CURSOR',400);return page('next')})
 await x.controller.nextPage();assert.equal(x.controller.getSnapshot().error.code,'INVALID_CURSOR');assert.equal(x.calls.length,2);assert.deepEqual(x.controller.getSnapshot().cursors,[null])
 await x.controller.refresh();assert.equal(x.calls.length,3);assert.equal(x.calls[2][2].cursor,undefined)
 const y=await setup(async()=>page('next'));await y.controller.nextPage();assert.equal(y.controller.getSnapshot().error.code,'INVALID_CURSOR')
})
test('network/timeout/schema errors retry GET; cancellation stays silent; unready scope makes no requests',async()=>{
 for(const error of [fail('NETWORK_ERROR'),new ApiError({kind:'timeout',code:'TIMEOUT',message:'Safe'}),new ApiError({kind:'client',code:'INVALID_API_RESPONSE',message:'Safe'})]){
 let count=0;const x=await setup(async()=>{if(count++===0)throw error;return page()});assert.equal(x.controller.getSnapshot().status,'error');await x.controller.refresh();assert.equal(x.controller.getSnapshot().status,'ready')
 }
 const x=await setup(async()=>{throw new axios.CanceledError()});assert.equal(x.controller.getSnapshot().error,null);assert.equal(x.controller.getSnapshot().status,'idle')
 let calls=0;const c=createKnowledgeController({listKnowledge:async()=>{calls++;return page()}},async()=>{});c.sync(null,'q=x');await tick();assert.equal(calls,0)
 const initial=initialKnowledgeState();const next=knowledgeReducer(initial,{status:'loading'});assert.notEqual(initial,next);assert.equal(initial.status,'idle')
})
test('scope/user/access key changes immediately clear data and reset pagination; StrictMode cleanup refetches',async()=>{
 const x=await setup(async()=>page('next'));await x.controller.nextPage()
 const pending=defer();const y=await setup(()=>pending.promise);y.controller.sync({...y.access,subject:'user-b',accessKey:{}},'q=new');assert.deepEqual(y.controller.getSnapshot().items,[]);pending.resolve(page());await tick();assert.equal(y.controller.getSnapshot().scope.subject,'user-b')
 x.controller.sync(null,'');assert.deepEqual(x.controller.getSnapshot().items,[]);x.controller.sync({...x.access,accessKey:{}},'');await tick();assert.equal(x.controller.getSnapshot().index,0)
 x.controller.stop();x.controller.sync(x.access,'');await tick();assert.equal(x.controller.getSnapshot().status,'ready')
})
