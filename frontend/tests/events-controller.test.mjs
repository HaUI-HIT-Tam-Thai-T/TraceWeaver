import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { CanceledError } from 'axios'
import { ApiError } from '../src/services/apiError.ts'
import { createEventsController } from '../src/features/events/state/controller.ts'
import { readEventLocation, readEventQuery } from '../src/features/events/query.ts'
import { EID, EID2, event, scope } from './event-fixtures.mjs'

const settle = async () => { await setImmediate(); await setImmediate() }
const deferred = () => Promise.withResolvers()
const error = (status, code = `HTTP_${status}`) => new ApiError({ kind: status === 401 ? 'auth' : 'http', status, code, message: 'safe' })

function fixture(overrides = {}) {
  const calls = { list: [], detail: [], denied: 0 }
  const controller = createEventsController({
    async listEvents(id, filters, options) { calls.list.push({ id, filters, ...options }); return { items: [event()], next_cursor: null } },
    async getEvent(id, eventId, signal) { calls.detail.push({ id, eventId, signal }); return event(eventId) },
    ...overrides,
  }, async () => { calls.denied += 1 })
  return { controller, calls }
}

test('no ready scope, inactive route or invalid query sends no events request', async () => {
  const { controller, calls } = fixture()
  controller.sync(null, true, readEventQuery(''))
  controller.sync(scope(), false, readEventQuery(''))
  controller.sync(scope(), true, readEventQuery('?limit=999'))
  await settle()
  assert.equal(calls.list.length, 0)
  assert.equal(controller.getSnapshot().status, 'invalid-query')
})

test('empty list is ready, and detail is fetched independently without auto-selecting a root', async () => {
  const { controller, calls } = fixture({ async listEvents() { return { items: [], next_cursor: null } } })
  controller.sync(scope(), true, readEventQuery(`?event_id=${EID}`))
  await settle()
  assert.equal(controller.getSnapshot().list.status, 'ready')
  assert.equal(controller.getSnapshot().list.items.length, 0)
  assert.equal(calls.detail.length, 1)
  assert.equal(controller.getSnapshot().root, null)
})

test('root requires ready detail and write role; viewer/admin cannot select', async () => {
  const detail = deferred()
  const { controller } = fixture({ async getEvent() { return detail.promise } })
  controller.sync(scope(), true, readEventQuery(`?event_id=${EID}`))
  assert.equal(controller.selectRoot(), false)
  detail.resolve(event())
  await settle()
  assert.equal(controller.selectRoot(), true)
  assert.equal(controller.getSnapshot().root.occurred_at, event().occurred_at)
  controller.clearRoot()
  assert.equal(controller.getSnapshot().root, null)
  controller.sync(scope(false), true, readEventQuery(`?event_id=${EID}`))
  await settle()
  assert.equal(controller.selectRoot(), false)
})

test('next/previous repeat snapshot filters and cursor, retain root but close detail', async () => {
  const requests = []
  const { controller } = fixture({ async listEvents(id, filters, options) {
    requests.push({ id, filters, ...options })
    return { items: [event(options.cursor ? EID2 : EID)], next_cursor: options.cursor ? null : 'opaque +/=' }
  } })
  controller.sync(scope(), true, readEventQuery(`?q=accepted&limit=25&event_id=${EID}`))
  await settle()
  controller.selectRoot()
  await controller.nextPage()
  assert.equal(requests[1].cursor, 'opaque +/=')
  assert.deepEqual(requests[1].filters, requests[0].filters)
  assert.equal(controller.getSnapshot().pageIndex, 1)
  assert.equal(controller.getSnapshot().detail.id, null)
  assert.equal(controller.getSnapshot().root.event_id, EID)
  assert.deepEqual(controller.getSnapshot().list.items.map((item) => item.event_id), [EID2])
  await controller.previousPage()
  assert.equal(requests[2].cursor, undefined)
  assert.equal(controller.getSnapshot().pageIndex, 0)
  await controller.refresh()
  assert.equal(controller.getSnapshot().root, null)
  assert.deepEqual(controller.getSnapshot().history, [null])
})

test('new filters abort previous list and reject its late result', async () => {
  const old = deferred()
  const calls = []
  const { controller } = fixture({ async listEvents(id, filters, options) {
    calls.push(options)
    return filters.q === 'old' ? old.promise : { items: [event(EID2)], next_cursor: null }
  } })
  const access = scope()
  controller.sync(access, true, readEventQuery('?q=old'))
  await settle()
  controller.sync(access, true, readEventQuery('?q=new'))
  assert.equal(calls[0].signal.aborted, true)
  await settle()
  old.resolve({ items: [event()], next_cursor: 'stale' })
  await settle()
  assert.equal(controller.getSnapshot().list.items[0].event_id, EID2)
  assert.equal(controller.getSnapshot().nextCursor, null)
})

test('fast detail changes ignore old detail, and logout invalidates everything', async () => {
  const old = deferred()
  const { controller, calls } = fixture({ async getEvent(id, eventId, signal) {
    calls.detail.push({ eventId, signal })
    return eventId === EID ? old.promise : event(EID2)
  } })
  const access = scope()
  controller.sync(access, true, readEventQuery(`?event_id=${EID}`))
  await settle()
  controller.sync(access, true, readEventQuery(`?event_id=${EID2}`))
  assert.equal(calls.detail[0].signal.aborted, true)
  await settle()
  old.resolve(event())
  await settle()
  assert.equal(controller.getSnapshot().detail.event.event_id, EID2)
  controller.selectRoot()
  controller.stop()
  assert.equal(controller.getSnapshot().root, null)
  assert.equal(controller.getSnapshot().scope, null)
  assert.equal(controller.getSnapshot().list.items.length, 0)
})

test('access revalidation, changed workspace/user and late responses cannot reuse event payload/root', async () => {
  const old = deferred()
  let count = 0
  const { controller } = fixture({ async listEvents() {
    count += 1
    return count === 1 ? old.promise : { items: [event(EID2)], next_cursor: null }
  } })
  controller.sync(scope(), true, readEventQuery(''))
  await settle()
  controller.sync(null, true, readEventQuery(''))
  assert.equal(controller.getSnapshot().list.items.length, 0)
  controller.sync({ ...scope(), subject: 'user-b' }, true, readEventQuery(''))
  await settle()
  old.resolve({ items: [event()], next_cursor: 'old' })
  await settle()
  assert.equal(controller.getSnapshot().scope.subject, 'user-b')
  assert.equal(controller.getSnapshot().list.items[0].event_id, EID2)
  assert.equal(controller.getSnapshot().root, null)
})

for (const status of [403, 404]) {
  test(`${status} purges data and rechecks workspace only once across revalidation`, async () => {
    let attempts = 0
    const { controller, calls } = fixture({ async listEvents() { attempts += 1; throw error(status) } })
    const query = readEventQuery('')
    const access = scope()
    controller.sync(access, true, query)
    await settle()
    assert.equal(controller.getSnapshot().status, 'blocked')
    controller.sync(null, true, query)
    controller.sync({ ...access, accessKey: {} }, true, query)
    await settle()
    assert.equal(attempts, 1)
    assert.equal(calls.denied, 1)
    assert.equal(controller.getSnapshot().list.items.length, 0)
    await controller.refresh()
    assert.equal(attempts, 2)
  })
}

test('401 requires login and cannot be refreshed/replayed by buttons', async () => {
  let attempts = 0
  const { controller, calls } = fixture({ async listEvents() { attempts += 1; throw error(401) } })
  controller.sync(scope(), true, readEventQuery(''))
  await settle()
  assert.equal(controller.getSnapshot().status, 'reauth')
  await controller.refresh()
  await controller.nextPage()
  assert.equal(attempts, 1)
  assert.equal(calls.denied, 0)
})

test('invalid cursor resets history, detail and root without auto retry', async () => {
  let count = 0
  const { controller } = fixture({ async listEvents() {
    count += 1
    if (count > 1) throw error(400, 'INVALID_CURSOR')
    return { items: [event()], next_cursor: 'expired-cursor' }
  } })
  controller.sync(scope(), true, readEventQuery(`?event_id=${EID}`))
  await settle()
  controller.selectRoot()
  await controller.nextPage()
  assert.equal(controller.getSnapshot().root, null)
  assert.equal(controller.getSnapshot().detail.id, null)
  assert.deepEqual(controller.getSnapshot().history, [null])
  assert.equal(controller.getSnapshot().list.error.code, 'INVALID_CURSOR')
  assert.equal(count, 2)
})

test('network/timeout/schema errors preserve applied filters; cancellation stays silent', async () => {
  for (const failure of [
    new ApiError({ kind: 'network', code: 'NETWORK_ERROR', message: 'safe' }),
    new ApiError({ kind: 'timeout', code: 'TIMEOUT', message: 'safe' }),
    new ApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'safe' }),
  ]) {
    const { controller } = fixture({ async listEvents() { throw failure } })
    controller.sync(scope(), true, readEventQuery('?q=keep-draft'))
    await settle()
    assert.equal(controller.getSnapshot().filters.q, 'keep-draft')
    assert.equal(controller.getSnapshot().list.error.code, failure.code)
  }
  const { controller } = fixture({ async listEvents() { throw new CanceledError() } })
  controller.sync(scope(), true, readEventQuery(''))
  await settle()
  assert.equal(controller.getSnapshot().list.error, null)
})


test('detail route validates path IDs and loads independently; returning preserves cursor page', async () => {
  assert.equal(readEventLocation('?limit=50', 'invalid').success, false)
  const filters = '?q=accepted&limit=25'
  assert.equal(readEventLocation(filters, EID).eventId, EID)
  const { controller, calls } = fixture()
  const currentScope = scope()
  controller.sync(currentScope, true, readEventLocation(filters, EID), false)
  await settle()
  assert.equal(calls.list.length, 0)
  assert.equal(calls.detail.length, 1)
  controller.sync(currentScope, true, readEventLocation(filters, null))
  await settle()
  assert.equal(calls.list.length, 1)
  assert.equal(controller.getSnapshot().detail.id, null)

  const pages = fixture({ async listEvents(id, filters, options) { return { items: [event()], next_cursor: options.cursor ? null : 'next-page' } } })
  pages.controller.sync(currentScope, true, readEventLocation(filters, null))
  await settle()
  await pages.controller.nextPage()
  const before = pages.controller.getSnapshot()
  pages.controller.sync(currentScope, true, readEventLocation(filters, EID), false)
  await settle()
  pages.controller.sync(currentScope, true, readEventLocation(filters, null))
  await settle()
  assert.equal(pages.controller.getSnapshot().pageIndex, 1)
  assert.deepEqual(pages.controller.getSnapshot().history, before.history)
  assert.deepEqual(pages.controller.getSnapshot().list, before.list)
  assert.equal(pages.controller.getSnapshot().detail.event, null)
})
