import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { CanceledError } from 'axios'
import { ApiError } from '../src/services/apiError.ts'
import { createWorkspaceController } from '../src/features/workspace/controller.ts'
import { createWorkspaceService } from '../src/features/workspace/createWorkspaceService.ts'
import { activeMembership, initialWorkspaceState, workspacePermissions, workspaceReducer } from '../src/features/workspace/state.ts'

const A = '10000000-0000-4000-8000-000000000001'
const B = '10000000-0000-4000-8000-000000000002'
const SOURCE = '30000000-0000-4000-8000-000000000001'
const membership = (id = A, roles = ['operator']) => ({ workspace_id: id, roles, group_ids: [] })
const me = (memberships = [membership()], subject = 'user-a') => ({ subject, memberships })
const source = (workspaceId = A) => ({ id: SOURCE, workspace_id: workspaceId, name: 'intake', service: 'intake', parser_version: 'v1' })
const page = (workspaceId = A, cursor = null) => ({ items: [source(workspaceId)], next_cursor: cursor })
const deferred = () => Promise.withResolvers()
const settle = async () => { await setImmediate(); await setImmediate() }
const failure = (status) => new ApiError({ kind: status === 401 ? 'auth' : 'http', code: `HTTP_${status}`, status, message: 'Safe failure' })

function fixture(overrides = {}) {
  const calls = { me: [], sources: [] }
  const service = {
    async getMe(signal) { calls.me.push(signal); return me() },
    async listSources(id, options) { calls.sources.push({ id, ...options }); return page(id) },
    ...overrides,
  }
  return { calls, controller: createWorkspaceController(service) }
}

test('inactive controller makes no calls; zero memberships never loads sources', async () => {
  const { controller, calls } = fixture({ async getMe(signal) { calls.me.push(signal); return me([]) } })
  await controller.refreshAccess()
  await controller.loadMoreSources()
  assert.equal(calls.me.length, 0)
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().me.memberships.length, 0)
  assert.equal(controller.getSnapshot().selectedWorkspaceId, null)
  assert.equal(calls.sources.length, 0)
})

test('one workspace auto-selects and loads only its granted sources', async () => {
  const { controller, calls } = fixture()
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().selectedWorkspaceId, A)
  assert.equal(calls.sources.length, 1)
  assert.equal(calls.sources[0].limit, 50)
  assert.equal(calls.sources[0].cursor, undefined)
  assert.deepEqual(controller.getSnapshot().sources.items, [source()])
})

test('multiple memberships require a valid selection, without automatic source requests', async () => {
  const { controller, calls } = fixture({ async getMe() { return me([membership(), membership(B, ['viewer'])]) } })
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().selectedWorkspaceId, null)
  assert.equal(calls.sources.length, 0)
  assert.equal(controller.selectWorkspace('not-a-membership'), false)
  assert.equal(controller.selectWorkspace(B), true)
  await settle()
  assert.equal(calls.sources[0].id, B)
  assert.deepEqual(workspacePermissions(activeMembership(controller.getSnapshot())), { canRead: true, canWrite: false, canVerify: false })
})

test('roles are workspace-specific; admin is not a writer and ingest_service is not a reader', async () => {
  assert.deepEqual(workspacePermissions(membership(A, ['admin'])), { canRead: true, canWrite: false, canVerify: false })
  assert.deepEqual(workspacePermissions(membership(A, ['reviewer'])), { canRead: true, canWrite: true, canVerify: true })
  assert.deepEqual(workspacePermissions(membership(A, ['ingest_service'])), { canRead: false, canWrite: false, canVerify: false })
  const { controller, calls } = fixture({ async getMe() { return me([membership(A, ['ingest_service'])]) } })
  await controller.start()
  await settle()
  assert.equal(calls.sources.length, 0)
})

test('empty sources and multiple cursor pages are handled without inventing totals', async () => {
  const calls = []
  const { controller } = fixture({ async listSources(id, options) {
    calls.push({ id, ...options })
    return options.cursor ? { items: [source()], next_cursor: null } : { items: [], next_cursor: 'opaque +/=' }
  } })
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().sources.status, 'ready')
  assert.equal(controller.getSnapshot().sources.items.length, 0)
  await controller.loadMoreSources()
  assert.equal(calls[1].cursor, 'opaque +/=')
  assert.equal(controller.getSnapshot().sources.items.length, 1)
  assert.equal(controller.getSnapshot().sources.nextCursor, null)
  await controller.loadMoreSources()
  assert.equal(calls.length, 2)
})

test('workspace switch clears the old page immediately and ignores old responses even without abort support', async () => {
  const oldPage = deferred()
  const calls = []
  const { controller } = fixture({
    async getMe() { return me([membership(), membership(B)]) },
    async listSources(id, options) { calls.push({ id, ...options }); return id === A ? oldPage.promise : page(B) },
  })
  await controller.start()
  controller.selectWorkspace(A)
  await settle()
  controller.selectWorkspace(B)
  assert.equal(calls[0].signal.aborted, true)
  assert.equal(controller.getSnapshot().sources.items.length, 0)
  await settle()
  oldPage.resolve(page(A, 'stale-cursor'))
  await settle()
  assert.equal(controller.getSnapshot().selectedWorkspaceId, B)
  assert.deepEqual(controller.getSnapshot().sources.items, [source(B)])
  assert.equal(controller.getSnapshot().sources.nextCursor, null)
})

test('logout/reset aborts and rejects late identity and source results; remount fetches anew', async () => {
  const pendingMe = deferred()
  let signal
  const { controller, calls } = fixture({ async getMe(s) { signal = s; return pendingMe.promise } })
  const started = controller.start()
  await settle()
  controller.stop()
  assert.equal(signal.aborted, true)
  pendingMe.resolve(me())
  await started
  await settle()
  assert.deepEqual(controller.getSnapshot(), initialWorkspaceState())
  assert.equal(calls.sources.length, 0)
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().status, 'ready')
  controller.stop()
  assert.deepEqual(controller.getSnapshot(), initialWorkspaceState())
})

test('late source response after logout cannot restore data', async () => {
  const response = deferred()
  const { controller } = fixture({ async listSources() { return response.promise } })
  await controller.start()
  await settle()
  controller.stop()
  response.resolve(page())
  await settle()
  assert.deepEqual(controller.getSnapshot(), initialWorkspaceState())
})

test('refresh coalesces focus/manual requests and hides old roles and sources until /me validates', async () => {
  const nextMe = deferred()
  let count = 0
  const { controller } = fixture({ async getMe() { count += 1; return count === 1 ? me() : nextMe.promise } })
  await controller.start()
  await settle()
  const first = controller.refreshAccess()
  assert.equal(first, controller.refreshAccess())
  assert.equal(controller.getSnapshot().me, null)
  assert.equal(controller.getSnapshot().selectedWorkspaceId, null)
  assert.deepEqual(controller.getSnapshot().sources.items, [])
  assert.equal(activeMembership(controller.getSnapshot()), null)
  nextMe.resolve(me([membership(A, ['viewer'])]))
  await first
  await settle()
  assert.equal(count, 2)
  assert.equal(workspacePermissions(activeMembership(controller.getSnapshot())).canWrite, false)
})

test('a changed subject never inherits the old workspace choice', async () => {
  let currentMe = me([membership(), membership(B)])
  const { controller } = fixture({ async getMe() { return currentMe } })
  await controller.start()
  controller.selectWorkspace(B)
  await settle()
  currentMe = me([membership(), membership(B)], 'user-b')
  await controller.refreshAccess()
  assert.equal(controller.getSnapshot().me.subject, 'user-b')
  assert.equal(controller.getSnapshot().selectedWorkspaceId, null)
  assert.equal(controller.getSnapshot().sources.items.length, 0)
})

for (const status of [403, 404]) {
  test(`source ${status} clears data and revalidates /me exactly once, without a retry loop`, async () => {
    let count = 0
    const { controller, calls } = fixture({ async listSources() { count += 1; throw failure(status) } })
    await controller.start()
    await settle()
    assert.equal(calls.me.length, 2)
    assert.equal(count, 1)
    assert.equal(controller.getSnapshot().selectedWorkspaceId, A)
    assert.equal(controller.getSnapshot().sources.status, 'error')
    assert.equal(controller.getSnapshot().sources.items.length, 0)
  })
}

test('source denial followed by membership revocation clears selection and does not reload sources', async () => {
  let meCalls = 0
  let sourceCalls = 0
  const { controller } = fixture({
    async getMe() { meCalls += 1; return meCalls === 1 ? me() : me([]) },
    async listSources() { sourceCalls += 1; throw failure(403) },
  })
  await controller.start()
  await settle()
  assert.equal(sourceCalls, 1)
  assert.equal(controller.getSnapshot().me.memberships.length, 0)
  assert.equal(controller.getSnapshot().selectedWorkspaceId, null)
})

test('401 stops automatic revalidation and purges all workspace data', async () => {
  let sourceCalls = 0
  const { controller, calls } = fixture({ async listSources() { sourceCalls += 1; throw failure(401) } })
  await controller.start()
  await settle()
  assert.equal(controller.getSnapshot().status, 'reauth')
  assert.equal(controller.getSnapshot().me, null)
  await controller.refreshAccess()
  await controller.loadMoreSources()
  assert.equal(calls.me.length, 1)
  assert.equal(sourceCalls, 1)
})

test('network failures can retry explicitly; cancellations are not errors', async () => {
  let attempt = 0
  const { controller } = fixture({ async getMe() {
    attempt += 1
    if (attempt === 1) throw new ApiError({ kind: 'network', code: 'NETWORK_ERROR', message: 'Safe error' })
    return me()
  } })
  await controller.start()
  assert.equal(controller.getSnapshot().status, 'error')
  await controller.refreshAccess()
  await settle()
  assert.equal(controller.getSnapshot().status, 'ready')
  const canceled = fixture({ async getMe() { throw new CanceledError() } })
  await canceled.controller.start()
  assert.equal(canceled.controller.getSnapshot().error, null)
})

test('StrictMode-style cleanup/remount ignores old requests and removes subscriptions', async () => {
  const first = deferred()
  let count = 0
  let oldSignal
  const { controller } = fixture({ async getMe(signal) {
    count += 1
    if (count === 1) { oldSignal = signal; return first.promise }
    return me([], 'new-session')
  } })
  let notifications = 0
  const unsubscribe = controller.subscribe(() => { notifications += 1 })
  const started = controller.start()
  await settle()
  controller.stop()
  assert.equal(oldSignal.aborted, true)
  await controller.start()
  first.resolve(me())
  await started
  assert.equal(controller.getSnapshot().me.subject, 'new-session')
  unsubscribe()
  const before = notifications
  controller.stop()
  assert.equal(notifications, before)
})

test('service validates DTOs, UUIDs, roles, groups, duplicate memberships and wrong-workspace sources', async () => {
  let payload = me()
  const requests = []
  const service = createWorkspaceService({ async get(path, options) { requests.push({ path, ...options }); return { data: payload } } })
  assert.deepEqual(await service.getMe(), me())
  for (const invalid of [
    { subject: '', memberships: [] },
    me([{ ...membership(), workspace_id: 'not-a-uuid' }]),
    me([membership(A, ['unknown-role'])]),
    me([{ ...membership(), group_ids: ['bad'] }]),
    me([membership(), membership()]),
  ]) {
    payload = invalid
    await assert.rejects(service.getMe(), { code: 'INVALID_API_RESPONSE' })
  }
  payload = page()
  const abort = new AbortController()
  await service.listSources(A, { cursor: 'opaque +/=', signal: abort.signal })
  const last = requests.at(-1)
  assert.equal(last.path, `/api/v1/workspaces/${A}/sources`)
  assert.equal(last.params.get('cursor'), 'opaque +/=')
  assert.equal(last.params.get('limit'), '50')
  assert.equal(last.signal, abort.signal)
  payload = page(B)
  await assert.rejects(service.listSources(A), { code: 'INVALID_API_RESPONSE' })
  payload = { items: [source()], next_cursor: 0 }
  await assert.rejects(service.listSources(A), { code: 'INVALID_API_RESPONSE' })
  await assert.rejects(service.listSources('bad'), { code: 'INVALID_SOURCE_QUERY' })
})

test('reducer updates are immutable and permissions derive from membership', () => {
  const previous = initialWorkspaceState()
  const next = workspaceReducer(previous, { type: 'accessReady', me: me(), selectedWorkspaceId: A })
  assert.equal(previous.me, null)
  assert.equal(previous.selectedWorkspaceId, null)
  assert.equal(activeMembership(next).workspace_id, A)
})

test('source timeout/schema errors remove old pages and retry from a fresh scope and cursor', async () => {
  for (const code of ['TIMEOUT', 'INVALID_API_RESPONSE']) {
    let count = 0
    const sourceCalls = []
    const { controller } = fixture({ async listSources(id, options) {
      sourceCalls.push({ id, ...options })
      count += 1
      if (count === 1) return page(A, 'page-two')
      if (count === 2) throw new ApiError({ kind: code === 'TIMEOUT' ? 'timeout' : 'client', code, message: 'Safe failure' })
      return page()
    } })
    await controller.start()
    await settle()
    await controller.loadMoreSources()
    assert.equal(controller.getSnapshot().sources.status, 'error')
    assert.equal(controller.getSnapshot().sources.items.length, 0)
    assert.equal(controller.getSnapshot().sources.nextCursor, null)
    await controller.refreshAccess()
    await settle()
    assert.equal(sourceCalls[2].cursor, undefined)
    assert.equal(controller.getSnapshot().sources.status, 'ready')
  }
})

test('/me errors never load sources; 401 needs login while 403 is an access error', async () => {
  for (const status of [401, 403, 503]) {
    const { controller, calls } = fixture({ async getMe() { throw failure(status) } })
    await controller.start()
    await settle()
    assert.equal(controller.getSnapshot().status, status === 401 ? 'reauth' : 'error')
    assert.equal(controller.getSnapshot().me, null)
    assert.equal(calls.sources.length, 0)
  }
})
