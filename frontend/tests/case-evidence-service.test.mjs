import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evidenceCreateSchema } from '../src/features/cases/schemas.ts'
import { createCasesService } from '../src/features/cases/services/createCasesService.ts'
import { WID, EID, EID2 } from './event-fixtures.mjs'
import { CID, caseDetail } from './case-fixtures.mjs'

test('evidence validation preserves note whitespace, enforces required fields and mode-specific limits',()=>{
  const note='  note\n detail  '
  assert.equal(evidenceCreateSchema.parse({kind:'note',event_ids:[],note}).note,note)
  for(const body of [{kind:'note',event_ids:[],note:' \n\t '},{kind:'events',event_ids:[],note:''},{kind:'events',event_ids:[EID,EID],note:''},{kind:'note',event_ids:[]},{kind:'note',event_ids:[],note:'x'.repeat(10001)},{kind:'note',event_ids:[],note:'x',expected_version:1}])assert.equal(evidenceCreateSchema.safeParse(body).success,false)
  assert.ok(evidenceCreateSchema.safeParse({kind:'events',event_ids:[EID],note:''}).success)
  assert.ok(evidenceCreateSchema.safeParse({kind:'note',event_ids:[],note:'x'.repeat(10000)}).success)
  const ids=Array.from({length:1001},(_,i)=>`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`)
  assert.ok(evidenceCreateSchema.safeParse({kind:'events',event_ids:ids.slice(0,1000),note:''}).success)
  assert.equal(evidenceCreateSchema.safeParse({kind:'events',event_ids:ids,note:''}).success,false)
})
test('POST evidence sends exact JSON and signal without version/key, validates case/kind/event set and permits redaction',async()=>{
  const calls=[]
  const response={...caseDetail().evidence[0],kind:'events',event_ids:[EID2,EID],note:'[REDACTED]'}
  const service=createCasesService({get:async()=>{},post:async(...args)=>{calls.push(args);return{data:response}}})
  const signal=new AbortController().signal,body={kind:'events',event_ids:[EID,EID2],note:'  original note\n '}
  const result=await service.addEvidence(WID,CID,body,signal)
  assert.equal(calls[0][0],`/api/v1/workspaces/${WID}/cases/${CID}/evidence`)
  assert.deepEqual(calls[0][1],body);assert.deepEqual(calls[0][2],{signal});assert.equal(result.note,'[REDACTED]')
  await assert.rejects(service.addEvidence(WID,CID,{...body,version:1}),{code:'INVALID_CASE_INPUT'})
  assert.equal(calls.length,1)
})
test('wrong case/kind/event refs and malformed evidence responses fail safely',async()=>{
  const body={kind:'note',event_ids:[],note:'note'}
  for(const data of [{...caseDetail().evidence[0],case_id:EID},{...caseDetail().evidence[0],kind:'events'},{...caseDetail().evidence[0],event_ids:[EID]},'<html>internal secret</html>']) {
    const service=createCasesService({get:async()=>{},post:async()=>({data})})
    await assert.rejects(service.addEvidence(WID,CID,body),error=>error.code==='INVALID_API_RESPONSE'&&!error.message.includes('secret'))
  }
})
