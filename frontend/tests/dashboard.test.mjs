import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { ApiError } from '../src/services/apiError.ts'
import { createDashboardService } from '../src/features/dashboard/services/createDashboardService.ts'
import { createDashboardController, initialDashboardState, dashboardReducer } from '../src/features/dashboard/state/controller.ts'
import { readDashboardQuery, writeDashboardQuery, waitingCaseQuery, toDashboardFilters, dashboardFormSchema } from '../src/features/dashboard/query.ts'
import { createCasesController } from '../src/features/cases/state/controller.ts'
import { createWorkspaceMutationEvents } from '../src/services/workspaceMutations.ts'
import { WID, scope } from './event-fixtures.mjs'
import { caseItem } from './case-fixtures.mjs'
const data=(filters={})=>({runs:12,degraded_runs:2,unresolved_events:7,waiting_cases:5,filters})
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{resolve,promise}}
const fail=(code,status)=>new ApiError({kind:status===401?'auth':status?'http':'network',code,status,message:'Safe'})
async function setup(get=async(w,f)=>data(f)) {
 const calls=[];let rechecks=0
 const controller=createDashboardController({getDashboard:async(...args)=>{calls.push(args);return get(...args)}},async()=>{rechecks++})
 const access=scope();controller.sync(access,'');await tick()
 return{controller,calls,access,rechecks:()=>rechecks}
}
test('dashboard time filters preserve fractional UTC, UTC+7, open bounds and ranges beyond an hour',()=>{
 const f=toDashboardFilters({from:'2026-10-26T00:00:00.000001',to:'2026-10-28T23:59:59.123456'})
 assert.equal(f.from,'2026-10-25T17:00:00.000001Z');assert.equal(f.to,'2026-10-28T16:59:59.123456Z')
 assert.deepEqual(readDashboardQuery('?'+writeDashboardQuery(f,true)),{success:true,filters:f,waiting:true})
 for(const q of ['?waiting=0','?from=x','?from=2026-10-28T00:00:00Z&to=2026-10-27T00:00:00Z','?from=2026-10-27T00:00:00Z&from=2026-10-27T00:00:00Z'])assert.equal(readDashboardQuery(q).success,false)
 assert.equal(dashboardFormSchema.safeParse({from:'2026-02-30T00:00',to:''}).success,false)
 assert.deepEqual(toDashboardFilters({from:'',to:''}),{})
})
test('dashboard GET validates four counters and echoed filters, permits equivalent timestamp precision',async()=>{
 const calls=[];let response=data();const s=createDashboardService({get:async(...args)=>{calls.push(args);return{data:response}}})
 await s.getDashboard(WID);assert.equal(calls[0][0],`/api/v1/workspaces/${WID}/dashboard`);assert.deepEqual(Object.fromEntries(calls[0][1].params),{})
 const filters={from:'2026-10-27T00:00:00.000000Z'};response=data({from:'2026-10-27T00:00:00Z'});await s.getDashboard(WID,filters)
 assert.deepEqual(Object.fromEntries(calls[1][1].params),filters)
 for(const value of [data({}),{...data(),runs:-1},{...data(),waiting_cases:1.5},'<html>secret</html>',{...data(),filters:{from:'invalid'}}]){response=value;await assert.rejects(s.getDashboard(WID,filters),{code:'INVALID_API_RESPONSE'})}
 await assert.rejects(s.getDashboard('bad'),{code:'INVALID_DASHBOARD_INPUT'})
 response={runs:0,degraded_runs:0,unresolved_events:0,waiting_cases:0,filters:{}};assert.deepEqual(await s.getDashboard(WID),response)
})
test('waiting drill-down uses two single-state queries with identical run.created_at filters and independent cursors',async()=>{
 const filters={from:'2026-10-27T00:00:00.123456Z',to:'2026-10-28T00:00:00Z'},access=scope(),calls=[]
 const service={getCase:async()=>{throw Error('unused')},listCases:async(w,f,o)=>{calls.push([w,f,o]);return{items:[{...caseItem(),state:f.state}],next_cursor:o.cursor?null:'cursor-'+f.state}}}
 const controllers=['new','assigned'].map(state=>{const c=createCasesController(service,async()=>{});c.sync(access,{kind:'list',search:waitingCaseQuery(filters,state)});return c})
 await tick();assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c[1]),[{...filters,state:'new',limit:50},{...filters,state:'assigned',limit:50}])
 await controllers[0].nextPage();assert.equal(calls[2][2].cursor,'cursor-new');assert.equal(controllers[1].getSnapshot().index,0)
 for(const c of controllers)c.stop()
})
test('mutation invalidation aborts stale GET, clears counter and refetches same scope/filters without POST retry',async()=>{
 const pending=defer();let count=0
 const x=await setup(async(w,f)=>++count===2?pending.promise:data(f));x.controller.sync(x.access,'from=2026-10-27T00%3A00%3A00Z');await tick()
 const signal=x.calls[1][2],events=createWorkspaceMutationEvents();const unsub=events.subscribe(x.controller.invalidateWorkspace)
 let posts=0;const body={reason:'original',expected_version:3},key='original-key'
 await events.afterMutation(WID,async()=>{posts++;return{body,key}});await tick()
 assert.equal(posts,1);assert.equal(x.calls.length,3);assert.ok(signal.aborted);assert.deepEqual(x.calls[2][1],{from:'2026-10-27T00:00:00Z'})
 pending.resolve({...data(),runs:999});await tick();assert.equal(x.controller.getSnapshot().data.runs,12)
 await events.afterMutation('other-workspace',async()=>{});await tick();assert.equal(x.calls.length,3)
 unsub();await events.afterMutation(WID,async()=>{});assert.equal(x.calls.length,3)
})
test('uncertain mutation and subscriber failure preserve original result/error, notify once, never replay',async()=>{
 const events=createWorkspaceMutationEvents();let notices=0,posts=0
 events.subscribe(()=>{throw Error('bad subscriber')});events.subscribe(wid=>{assert.equal(wid,WID);notices++})
 const value={body:{expected_version:7},key:'frozen'};assert.equal(await events.afterMutation(WID,async()=>{posts++;return value}),value)
 const timeout=fail('TIMEOUT');await assert.rejects(events.afterMutation(WID,async()=>{posts++;throw timeout}),error=>error===timeout)
 assert.equal(posts,2);assert.equal(notices,2)
})
test('filter, workspace, identity, access revalidation and stop reject stale responses; waiting toggle does not refetch counters',async()=>{
 const p=defer();const x=await setup(async(w,f)=>f.from?p.promise:data(f))
 x.controller.sync(x.access,'waiting=1');await tick();assert.equal(x.calls.length,1)
 x.controller.sync(x.access,'from=2026-10-27T00:00:00Z');await tick();x.controller.sync({...x.access,subject:'user-b',accessKey:{}},'');await tick();p.resolve({...data(),runs:999});await tick();assert.equal(x.controller.getSnapshot().data.runs,12)
 x.controller.sync(null,'');assert.equal(x.controller.getSnapshot().data,null);x.controller.sync(x.access,'');await tick();assert.equal(x.controller.getSnapshot().status,'ready');x.controller.stop();assert.deepEqual(x.controller.getSnapshot(),initialDashboardState())
})
test('401/403/404 purge dashboard; access denial remains latched through revalidation without loops',async()=>{
 for(const status of [401,403,404]){
 const x=await setup(async()=>{throw fail('HTTP_'+status,status)});assert.equal(x.controller.getSnapshot().data,null);assert.equal(x.rechecks(),status===401?0:1)
 x.controller.sync(null,'');x.controller.sync({...x.access,accessKey:{}},'');await tick();assert.equal(x.calls.length,1)
 x.controller.invalidateWorkspace(WID);await tick();assert.equal(x.calls.length,1)
 }
 const y=await setup();y.controller.accessDenied(fail('HTTP_403',403));assert.equal(y.controller.getSnapshot().data,null);assert.equal(y.rechecks(),1)
})
test('GET errors retry safely, invalid URL makes no request, cancellation stays silent and reducer is immutable',async()=>{
 let count=0;const x=await setup(async(w,f)=>{if(count++===0)throw fail('NETWORK_ERROR');return data(f)})
 assert.equal(x.controller.getSnapshot().status,'error');await x.controller.refresh();assert.equal(x.controller.getSnapshot().status,'ready')
 x.controller.sync(x.access,'from=bad');await tick();assert.equal(x.calls.length,2);assert.equal(x.controller.getSnapshot().status,'invalid')
 const y=await setup(async()=>{throw new axios.CanceledError()});assert.equal(y.controller.getSnapshot().error,null)
 const initial=initialDashboardState();assert.notEqual(dashboardReducer(initial,{status:'loading'}),initial);assert.equal(initial.status,'idle')
})
