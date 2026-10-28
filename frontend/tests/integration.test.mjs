import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runFormDefaults, toRunBody } from '../src/features/reconstruction/form.ts'
import { integrationFixture, settle, deferred } from './integration-fixtures.mjs'
import { event, EID, WID } from './event-fixtures.mjs'
import { CID } from './case-fixtures.mjs'
const posts=x=>x.server.requests.filter(r=>r.method==='POST')
async function createRunAndCase(x){
 assert.equal(x.events.selectRoot(),true)
 await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()))
 assert.equal(x.reconstruction.getSnapshot().graphStatus,'ready')
 await x.creation.create('Integration case');assert.equal(x.creation.getSnapshot().caseId,CID)
 x.openCase();await settle();assert.equal(x.cases.getSnapshot().detail.status,'ready')
}
async function transition(x,action,reason='integration '+action){
 x.cases.beginNewTransition();const version=x.cases.getSnapshot().detail.data.case.version
 await x.cases.submitTransition({action,expected_version:version,reason,...(action==='assign'?{owner_id:x.server.subject}:{})})
 await settle()
}
function assertPurged(x){
 assert.equal(x.events.getSnapshot().root,null);assert.equal(x.events.getSnapshot().detail.event,null);assert.deepEqual(x.events.getSnapshot().list.items,[])
 const r=x.reconstruction.getSnapshot();assert.equal(r.run,null);assert.equal(r.graph,null);assert.equal(r.attempt,null)
 const c=x.cases.getSnapshot();assert.equal(c.detail.data,null);assert.deepEqual(c.list.items,[]);assert.deepEqual(c.snapshot.events,[]);assert.equal(c.workflow.attempt,null)
 assert.equal(x.creation.getSnapshot().attempt,null);assert.equal(x.creation.getSnapshot().caseId,null)
 assert.equal(x.dashboard.getSnapshot().data,null);assert.deepEqual(x.knowledge.getSnapshot().items,[])
}
test('integration: operator event→root→run/graph→review→case/evidence→workflow→dashboard; reviewer fail/close/reopen',async t=>{
 const x=await integrationFixture();t.after(()=>x.close())
 assert.equal(x.sdk.initCount,1);assert.equal(x.workspace.getSnapshot().sources.items.length,1)
 assert.equal(x.events.selectRoot(),true)
 await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()))
 const link=x.reconstruction.getSnapshot().graph.links[0]
 await x.reconstruction.reviewLink(link.id,{decision:'accepted',reason:'checked',expected_version:link.version})
 assert.equal(x.reconstruction.getSnapshot().graph.links[0].review_state,'accepted')
 await x.creation.create('Integration case');x.openCase();await settle()
 await x.cases.submitEvidence({kind:'note',event_ids:[],note:'Handling note\nPreserve lines'})
 assert.equal(x.cases.getSnapshot().detail.data.case.version,1)
 for(const action of ['assign','start','request_verification'])await transition(x,action)
 assert.equal(x.cases.getSnapshot().detail.data.case.state,'awaiting_verification');assert.equal(x.cases.getSnapshot().detail.data.case.version,4)
 const before=posts(x).length;await transition(x,'verify_close');assert.equal(posts(x).length,before)
 x.server.role='reviewer';await x.workspace.refreshAccess();await settle();assert.equal(x.permissions().canVerify,true)
 await transition(x,'verification_failed');assert.equal(x.cases.getSnapshot().detail.data.case.state,'investigating')
 await transition(x,'request_verification');await transition(x,'verify_close','verified close');assert.equal(x.cases.getSnapshot().detail.data.case.state,'closed')
 await transition(x,'reopen','additional investigation');assert.equal(x.cases.getSnapshot().detail.data.case.state,'investigating')
 await settle();assert.equal(x.dashboard.getSnapshot().data.waiting_cases,0)
 assert.ok(posts(x).filter(p=>p.url.endsWith('/transitions')).every(p=>p.key&&p.body.expected_version>0))
})
test('integration: viewer/admin read only; reviewer rights derive from /me rather than stale role state',async t=>{
 for(const role of ['viewer','admin','reviewer']){
  const x=await integrationFixture({role,seed:true});t.after(()=>x.close());x.openCase();await settle()
  assert.equal(x.knowledge.getSnapshot().items.length,1);assert.equal(x.cases.getSnapshot().detail.data.case.id,CID)
  const before=posts(x).length
  await x.cases.submitEvidence({kind:'note',event_ids:[],note:'note'})
  await transition(x,'assign')
  if(role==='reviewer'){assert.ok(posts(x).length>before);assert.equal(x.permissions().canVerify,true)}
  else{assert.equal(posts(x).length,before);assert.equal(x.permissions().canWrite,false);assert.equal(x.events.selectRoot(),false)}
 }
})
test('integration: shared refresh before concurrent real Axios services; cancellation does not cancel shared SDK refresh',async t=>{
 const x=await integrationFixture();t.after(()=>x.close())
 const gate=deferred(),abort=new AbortController();x.sdk.refreshGate=gate.promise
 const initial=x.sdk.refreshCount,requests=x.server.requests.length
 const canceled=x.services.knowledge.listKnowledge(WID,{limit:50},{signal:abort.signal});const cancellation=assert.rejects(canceled,error=>error.code==='ERR_CANCELED')
 const dashboard=x.services.dashboard.getDashboard(WID),knowledge=x.services.knowledge.listKnowledge(WID)
 await settle();assert.equal(x.sdk.refreshCount,initial+1);assert.equal(x.server.requests.length,requests)
 abort.abort();gate.resolve();await cancellation;await Promise.all([dashboard,knowledge]);assert.equal(x.server.requests.length,requests+2);assert.equal(x.auth.getSnapshot().status,'authenticated')
})
test('integration: refresh failure sends no HTTP and purges populated state across all features',async t=>{
 const x=await integrationFixture({seed:true});t.after(()=>x.close());x.events.selectRoot();await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()));x.openCase();await settle()
 const requests=x.server.requests.length;x.sdk.failRefresh=true;await x.dashboard.refresh();await settle()
 assert.equal(x.server.requests.length,requests);assert.equal(x.auth.getSnapshot().status,'unauthenticated');assert.equal(x.sdk.token,undefined);assertPurged(x)
})
test('integration: logout during a late case POST purges attempts/artifacts; late result cannot restore data',async t=>{
 const x=await integrationFixture();t.after(()=>x.close());x.events.selectRoot();await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()))
 const gate=deferred();x.server.intercept=async(config,r,reply)=>r.method==='POST'&&r.url.endsWith('/cases')?gate.promise.then(()=>reply(config,{...x.server.detail?.case,id:CID})):undefined
 const pending=x.creation.create('Pending case');await settle();assert.equal(x.creation.getSnapshot().status,'sending')
 await x.auth.signOut();assertPurged(x);gate.resolve();await pending;await settle();assertPurged(x)
})
test('integration: stale Link.version from 409 refetches graph without replay, stale Case.version requires explicit adoption',async t=>{
 const x=await integrationFixture();t.after(()=>x.close());x.events.selectRoot();await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()))
 const link=x.reconstruction.getSnapshot().graph.links[0];x.server.conflictReview=true
 await x.reconstruction.reviewLink(link.id,{decision:'accepted',reason:'review draft',expected_version:link.version})
 assert.equal(x.reconstruction.getSnapshot().mutation.status,'conflict');assert.equal(x.reconstruction.getSnapshot().graph.links[0].version,2)
 assert.equal(posts(x).filter(p=>p.url.endsWith('/reviews')).length,1)
 await x.creation.create('Case');x.openCase();await settle();x.server.conflictTransition=true
 await transition(x,'assign');assert.equal(x.cases.getSnapshot().workflow.status,'conflict');assert.equal(x.cases.getSnapshot().detail.data.case.version,2)
 const first=posts(x).filter(p=>p.url.endsWith('/transitions'));assert.equal(first.length,1)
 await x.cases.submitTransition({action:'assign',reason:'same',owner_id:x.server.subject,expected_version:2});assert.equal(posts(x).filter(p=>p.url.endsWith('/transitions')).length,1)
 await transition(x,'assign');const attempts=posts(x).filter(p=>p.url.endsWith('/transitions'));assert.equal(attempts.length,2);assert.notEqual(attempts[0].key,attempts[1].key)
})
test('integration: ambiguous create-case retries exact body/key; ambiguous evidence only GETs detail and never replays',async t=>{
 const x=await integrationFixture();t.after(()=>x.close());x.events.selectRoot();await x.reconstruction.create(toRunBody(runFormDefaults(event()),event()));x.server.timeoutCase=true
 await x.creation.create('Frozen title');assert.equal(x.creation.getSnapshot().status,'uncertain');await settle()
 const before=posts(x).filter(p=>p.url.endsWith('/cases'));assert.equal(before.length,1)
 await x.creation.retry();assert.equal(x.creation.getSnapshot().caseId,CID)
 const attempts=posts(x).filter(p=>p.url.endsWith('/cases'));assert.equal(attempts.length,2);assert.deepEqual(attempts[0].body,attempts[1].body);assert.equal(attempts[0].key,attempts[1].key)
 x.openCase();await settle();x.server.timeoutEvidence=true
 await x.cases.submitEvidence({kind:'note',event_ids:[],note:'Uncertain note'})
 assert.equal(x.cases.getSnapshot().evidenceMutation.status,'uncertain');assert.equal(x.cases.getSnapshot().detail.data.evidence.length,1);assert.equal(x.cases.getSnapshot().detail.data.case.version,1)
 await x.cases.submitEvidence({kind:'note',event_ids:[],note:'Uncertain note'});assert.equal(posts(x).filter(p=>p.url.endsWith('/evidence')).length,1)
})
test('integration: revoking grants with membership retained purges artifacts and does not loop or reuse old scope',async t=>{
 const x=await integrationFixture();t.after(()=>x.close());await createRunAndCase(x)
 assert.ok(x.cases.getSnapshot().detail.data);assert.ok(x.dashboard.getSnapshot().data)
 const oldKey=x.scope().accessKey;x.server.grants=false;await x.cases.refresh();await settle()
 assert.notEqual(x.scope().accessKey,oldKey);assert.equal(x.workspace.getSnapshot().sources.items.length,0)
 assert.equal(x.cases.getSnapshot().detail.data,null);assert.equal(x.dashboard.getSnapshot().data,null);assert.deepEqual(x.knowledge.getSnapshot().items,[]);assert.equal(x.reconstruction.getSnapshot().graph,null)
 const requests=x.server.requests.length;await settle();await settle();assert.equal(x.server.requests.length,requests)
 x.server.member=false;await x.workspace.refreshAccess();await settle();assert.equal(x.scope(),null);assertPurged(x)
})
test('integration: revalidation/user change while event response is delayed cannot repopulate previous scope',async t=>{
 const x=await integrationFixture({seed:true});t.after(()=>x.close())
 const gate=deferred();x.server.intercept=async(config,r,reply)=>r.url.endsWith('/events/'+EID)?gate.promise.then(()=>reply(config,{...event(),message:'OLD USER PAYLOAD'})):undefined
 await x.events.refresh();const opening=x.events.openDetail(EID);await settle()
 x.server.subject='second-user';x.server.intercept=null;const refreshing=x.workspace.refreshAccess();assertPurged(x);await refreshing;await settle()
 gate.resolve();await opening;await settle();assert.equal(x.scope().subject,'second-user');assert.notEqual(x.events.getSnapshot().detail.event?.message,'OLD USER PAYLOAD');assert.equal(x.events.getSnapshot().root,null)
})
