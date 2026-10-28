import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caseCreateSchema, caseDetailSchema } from '../src/features/cases/schemas.ts'
import { readCaseQuery, writeCaseQuery, toCaseFilters, caseFilterDefaults, caseFilterFormSchema } from '../src/features/cases/query.ts'
import { createCasesService } from '../src/features/cases/createCasesService.ts'
import { WID, EID } from './event-fixtures.mjs'
import { RID } from './reconstruction-fixtures.mjs'
import { CID, caseItem, caseDetail } from './case-fixtures.mjs'

test('case query validates state, opaque subject, duplicate params, limits and multi-day UTC+7 window', () => {
  assert.ok(readCaseQuery('?owner_id=not-a-uuid&state=assigned').success)
  for (const query of ['?state=waiting','?state=new&state=assigned','?limit=0','?limit=26','?owner_id=','?from=2026-10-27T07:00:00%2B07:00','?from=2026-10-28T00:00:00Z&to=2026-10-27T00:00:00Z']) assert.equal(readCaseQuery(query).success,false)
  const values = { state: '', owner_id: '', from:'2026-10-26T00:00:00.000001', to:'2026-10-28T23:59:59.123456', limit:'25' }
  const filters = toCaseFilters(values)
  assert.equal(filters.from,'2026-10-25T17:00:00.000001Z'); assert.equal(filters.to,'2026-10-28T16:59:59.123456Z')
  assert.deepEqual(caseFilterDefaults(filters),values)
  assert.ok(caseFilterFormSchema.safeParse(values).success)
  assert.equal(caseFilterFormSchema.safeParse({...values,from:'2026-02-30T00:00'}).success,false)
  assert.deepEqual(readCaseQuery(`?${writeCaseQuery(filters)}`).filters,filters)
})
test('strict create DTO trims title and rejects blanks/overflow/extra workflow fields; detail is envelope', () => {
  assert.equal(caseCreateSchema.parse({run_id:RID,title:' case '}).title,'case')
  for (const title of ['  ','x'.repeat(301)]) assert.equal(caseCreateSchema.safeParse({run_id:RID,title}).success,false)
  assert.equal(caseCreateSchema.safeParse({run_id:RID,title:'x',state:'new'}).success,false)
  assert.ok(caseDetailSchema.safeParse(caseDetail()).success)
  assert.equal(caseDetailSchema.safeParse(caseItem()).success,false)
  const wrong = caseDetail(); wrong.evidence[0].case_id=EID
  assert.equal(caseDetailSchema.safeParse(wrong).success,false)
  assert.equal(caseDetailSchema.parse(caseDetail()).history[0].occurred_at,'2026-10-27T07:00:00.000001Z')
})
test('case services use correct body/key/query and preserve run-created filters rather than filtering by case date', async () => {
  const calls=[]
  const client={post:async(...args)=>{calls.push(args);return{data:caseItem(),headers:{Location:'https://evil.invalid'}}},get:async(...args)=>{calls.push(args);return{data:args[0].endsWith(CID)?caseDetail():{items:[caseItem()],next_cursor:'next'}}}}
  const service=createCasesService(client),signal=new AbortController().signal
  await service.createCase(WID,{run_id:RID,title:'  case  '},{idempotencyKey:'key-1',signal})
  assert.deepEqual(calls[0][1],{run_id:RID,title:'case'});assert.equal(calls[0][2].headers['Idempotency-Key'],'key-1')
  const filters={from:'2026-10-01T00:00:00Z',to:'2026-10-02T00:00:00Z',state:'new',owner_id:'opaque-subject',limit:25}
  const page=await service.listCases(WID,filters,{cursor:'cursor',signal})
  assert.equal(page.items.length,1) // created_at is outside this window: BE filters parent run.created_at.
  assert.deepEqual(Object.fromEntries(calls[1][1].params),{limit:'25',state:'new',owner_id:'opaque-subject',from:filters.from,to:filters.to,cursor:'cursor'})
  await service.getCase(WID,CID,signal);assert.deepEqual(calls[2][1],{signal})
  assert.equal(calls[2][0],`/api/v1/workspaces/${WID}/cases/${CID}`)
})
test('case services reject wrong workspace/run/detail IDs and malformed payloads without leaking raw response', async()=>{
  for(const data of [{...caseItem(),workspace_id:EID},{...caseItem(),run_id:EID},'<html>secret</html>']) {
    const service=createCasesService({post:async()=>({data}),get:async()=>({data})})
    await assert.rejects(service.createCase(WID,{run_id:RID,title:'case'},{idempotencyKey:'key'}),{code:'INVALID_API_RESPONSE'})
  }
  const wrong=caseDetail(EID), service=createCasesService({get:async()=>({data:wrong}),post:async()=>({data:caseItem()})})
  await assert.rejects(service.getCase(WID,CID),{code:'INVALID_API_RESPONSE'})
  await assert.rejects(service.listCases('bad',{limit:50}),{code:'INVALID_CASE_INPUT'})
})
