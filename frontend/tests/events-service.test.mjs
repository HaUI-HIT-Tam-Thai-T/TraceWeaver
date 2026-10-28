import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEventsService } from '../src/features/events/services/createEventsService.ts'
import { compareUtc, eventSchema, filtersSchema } from '../src/features/events/schemas.ts'
import { eventFormSchema, formToFilters, formDefaults, localToUtc, readEventQuery, writeEventQuery } from '../src/features/events/query.ts'
import { EID, SID, WID, event } from './event-fixtures.mjs'

test('URL query validates known fields, duplicates, limits and time intervals', () => {
  const valid = readEventQuery(`?source_id=${SID}&action=request.accepted&q=hello+world&limit=25&event_id=${EID}`)
  assert.equal(valid.success, true)
  assert.equal(valid.filters.q, 'hello world')
  assert.equal(valid.filters.limit, 25)
  assert.equal(valid.eventId, EID)
  assert.equal(readEventQuery('').filters.limit, 50)
  for (const search of [
    '?q=', '?q=a&q=b', '?limit=10', '?limit=101', '?source_id=invalid', '?event_id=bad',
    '?from=2026-02-30T00:00:00Z', '?from=2026-10-26T00:00:00%2B07:00',
    '?from=2026-10-26T00:00:00.000002Z&to=2026-10-26T00:00:00.000001Z',
    `?q=${'x'.repeat(501)}`, `?action=${'x'.repeat(201)}`,
  ]) assert.equal(readEventQuery(search).success, false, search)
  assert.equal('outcome' in readEventQuery('?outcome=failed').filters, false)
})

test('UTC+7 form conversion keeps microseconds, round trips and rejects invalid local dates', () => {
  assert.equal(localToUtc('2026-10-27T02:30'), '2026-10-26T19:30:00Z')
  assert.equal(localToUtc('2026-10-27T13:00:00.123456'), '2026-10-27T06:00:00.123456Z')
  assert.throws(() => localToUtc('2026-02-30T10:00'))
  assert.throws(() => localToUtc('2026-10-27T25:00'))
  assert.equal(compareUtc('2026-10-26T00:00:00.000001Z', '2026-10-26T00:00:00Z'), 1)
  const filters = { from: '2026-10-26T06:00:00.123456Z', to: '2026-10-26T06:00:01Z', limit: 50 }
  assert.deepEqual(formToFilters(formDefaults(filters)), filters)
  const draft = { source_id: '', from: '', to: '', action: '', q: '', limit: '50' }
  assert.deepEqual(formToFilters(draft), { limit: 50 })
  assert.equal(eventFormSchema.safeParse({ ...draft, from: '2026-10-27T10:00', to: '2026-10-27T09:00' }).success, false)
  assert.equal(eventFormSchema.safeParse({ ...draft, from: '2026-02-30T10:00' }).success, false)
})

test('URL serialization contains only applied filters and detail ID, never cursor/payload/root', () => {
  const filters = { source_id: SID, q: 'a +&/=', limit: 100 }
  const params = writeEventQuery(filters, EID)
  const roundTrip = readEventQuery(params.toString())
  assert.deepEqual(roundTrip.filters, filters)
  assert.equal(roundTrip.eventId, EID)
  assert.equal(params.has('cursor'), false)
  assert.equal(params.has('root'), false)
  assert.equal(params.has('payload'), false)
})

test('event schema preserves exact UTC/provenance and rejects malformed fields', () => {
  assert.equal(eventSchema.parse(event()).occurred_at, '2026-10-26T06:00:00.000001Z')
  for (const value of [
    { ...event(), event_id: 'bad' }, { ...event(), outcome: 'pending' },
    { ...event(), occurred_at: '2026-10-26T06:00Z' },
    { ...event(), provenance: { ...event().provenance, sha256_redacted: 'bad' } },
    { ...event(), payload_redacted: [] },
  ]) assert.equal(eventSchema.safeParse(value).success, false)
  assert.equal(filtersSchema.safeParse({ limit: 50, outcome: 'failed' }).success, false)
})

test('service repeats filters/limit with opaque cursor and fetches detail without query', async () => {
  let data = { items: [event()], next_cursor: 'opaque +/=' }
  const calls = []
  const service = createEventsService({ async get(path, config) { calls.push({ path, config }); return { data } } })
  const filters = { source_id: SID, q: 'accepted', action: 'request.accepted', from: '2026-10-26T06:00:00.000001Z', limit: 50 }
  const controller = new AbortController()
  await service.listEvents(WID, filters, { signal: controller.signal, cursor: 'opaque +/=' })
  assert.equal(calls[0].path, `/api/v1/workspaces/${WID}/events`)
  assert.equal(calls[0].config.params.get('from'), filters.from)
  assert.equal(calls[0].config.params.get('cursor'), 'opaque +/=')
  assert.equal(calls[0].config.params.get('source_id'), SID)
  assert.equal(calls[0].config.params.get('limit'), '50')
  assert.equal(calls[0].config.signal, controller.signal)
  data = event()
  assert.deepEqual(await service.getEvent(WID, EID, controller.signal), event())
  assert.equal(calls[1].config.params, undefined)
  assert.equal(calls[1].path, `/api/v1/workspaces/${WID}/events/${EID}`)
  data = { ...event(), event_id: WID }
  await assert.rejects(service.getEvent(WID, EID), { code: 'INVALID_API_RESPONSE' })
  data = { items: [event()], next_cursor: 5 }
  await assert.rejects(service.listEvents(WID, filters), { code: 'INVALID_API_RESPONSE' })
  data = { items: [{ ...event(), source_id: WID }], next_cursor: null }
  await assert.rejects(service.listEvents(WID, filters), { code: 'INVALID_API_RESPONSE' })
  await assert.rejects(service.getEvent('bad', EID), { code: 'INVALID_EVENT_QUERY' })
  await assert.rejects(service.listEvents(WID, { limit: 101 }), { code: 'INVALID_EVENT_QUERY' })
})
