import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReconstructionService } from '../src/features/reconstruction/services/createReconstructionService.ts'
import { runCreateSchema, validateRoot, shiftUtc, graphSchema } from '../src/features/reconstruction/schemas.ts'
import { runFormDefaults, toRunBody, runFormSchema } from '../src/features/reconstruction/form.ts'
import { event, WID, SID, EID2 } from './event-fixtures.mjs'
import { run, graph, RID } from './reconstruction-fixtures.mjs'

const body = () => toRunBody(runFormDefaults(event()), event())
test('run defaults, UTC+7 conversion and fractional precision survive boundaries', () => {
  const defaults = runFormDefaults(event())
  assert.equal(defaults.from, '2026-10-26T12:55:00.000001')
  assert.equal(body().window.from, '2026-10-26T05:55:00.000001Z')
  assert.equal(shiftUtc('2026-12-31T23:59:59.123456789Z', 300), '2027-01-01T00:04:59.123456789Z')
  const value = body()
  value.window.to = shiftUtc(value.window.from, 3600)
  assert.ok(runCreateSchema.safeParse(value).success)
  value.window.to = value.window.to.replace('.000001', '.000002')
  assert.equal(runCreateSchema.safeParse(value).success, false)
  assert.equal(runCreateSchema.safeParse({ ...body(), source_ids: [SID, SID] }).success, false)
  assert.equal(runCreateSchema.safeParse({ ...body(), source_ids: [] }).success, false)
  assert.equal(validateRoot({ ...body(), root_event_id: EID2 }, event()), false)
  assert.equal(validateRoot({ ...body(), source_ids: [EID2] }, event()), false)
  assert.equal(runFormSchema(event()).safeParse({ ...defaults, from: '', to: '' }).success, false)
  assert.equal(runFormSchema(event()).safeParse({ ...defaults, from: '2026-02-30T00:00' }).success, false)
  assert.equal(validateRoot({ ...body(), window: { from: event().occurred_at, to: event().occurred_at } }, event()), true)
})
test('services preserve key/body and never follow external Location; get endpoints have no query', async () => {
  const calls = []
  const client = {
    post: async (...args) => { calls.push(args); return { status: 202, headers: { Location: 'https://evil.invalid' }, data: run() } },
    get: async (...args) => { calls.push(args); return { data: args[0].endsWith('/graph') ? graph() : run() } },
  }
  const service = createReconstructionService(client)
  const signal = new AbortController().signal
  assert.equal((await service.createRun(WID, body(), { idempotencyKey: 'key-1', signal })).status, 'completed')
  assert.deepEqual(calls[0][1], body())
  assert.equal(calls[0][2].headers['Idempotency-Key'], 'key-1')
  await service.getRun(WID, RID, signal)
  await service.getGraph(WID, RID, signal)
  assert.equal(calls[1][0], `/api/v1/workspaces/${WID}/runs/${RID}`)
  assert.deepEqual(calls[2][1], { signal })
  await assert.rejects(service.createRun(WID, body(), { idempotencyKey: 'bad key' }), { code: 'INVALID_RUN_INPUT' })
  assert.equal(calls.length, 3)
})
test('schemas reject malformed graph references, duplicate IDs, scores and incorrect run responses', async () => {
  assert.ok(graphSchema.safeParse(graph()).success)
  for (const mutate of [g => g.links[0].to_event_id = RID, g => g.links[0].score = 2, g => g.nodes.push(g.nodes[0]), g => g.unresolved_event_ids.push(RID), g => g.links[0].evidence[0].event_ids.push(RID)]) {
    const g = graph(); mutate(g); assert.equal(graphSchema.safeParse(g).success, false)
  }
  const service = createReconstructionService({ get: async () => ({ data: { ...graph(), run_id: EID2 } }), post: async () => ({ data: run('completed', { root_event_id: EID2 }) }) })
  await assert.rejects(service.getGraph(WID, RID), { code: 'INVALID_API_RESPONSE' })
  await assert.rejects(service.createRun(WID, body(), { idempotencyKey: 'key' }), { code: 'INVALID_API_RESPONSE' })
})
