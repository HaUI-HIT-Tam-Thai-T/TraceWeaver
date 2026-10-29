import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import axios, { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { createApiClient } from '../src/services/createApiClient.ts'
import { ApiError } from '../src/services/apiError.ts'

function deferred() {
  const { promise, resolve, reject } = Promise.withResolvers()
  return { promise, resolve, reject }
}

function fixture({ getAccessToken = async () => 'test-access-token', adapter } = {}) {
  const sent = []
  const client = createApiClient({ baseURL: '', getAccessToken })
  client.defaults.adapter = async (config) => {
    sent.push(config)
    return adapter ? adapter(config) : {
      data: { items: [], next_cursor: null }, status: 200, statusText: 'OK',
      headers: new AxiosHeaders({ 'X-Request-ID': 'success-id' }), config,
    }
  }
  return { client, sent }
}

function httpFailure(status, data, headers = {}) {
  return (config) => {
    throw new AxiosError('raw failure test-access-token', 'ERR_BAD_RESPONSE', config,
      { sensitive: 'raw request' }, {
        status, statusText: 'Error', data, headers: new AxiosHeaders(headers), config,
      })
  }
}

test('waits for refreshed token, uses HTTP defaults, and retains the full Axios response', async () => {
  const token = deferred()
  const { client, sent } = fixture({ getAccessToken: () => token.promise })
  const pending = client.get('/api/v1/me')
  await setImmediate()
  assert.equal(sent.length, 0)
  token.resolve('fresh-token')
  const response = await pending
  assert.equal(sent.length, 1)
  assert.equal(sent[0].headers.get('Authorization'), 'Bearer fresh-token')
  assert.equal(sent[0].headers.get('Accept'), 'application/json')
  assert.equal(sent[0].timeout, 10000)
  assert.equal(sent[0].withCredentials, false)
  assert.deepEqual(response.data, { items: [], next_cursor: null })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Request-ID'), 'success-id')
})

test('production factory applies its configured origin', async () => {
  const client = createApiClient({ baseURL: 'https://api.example.test', getAccessToken: async () => 'token' })
  client.defaults.adapter = async (config) => {
    assert.equal(client.getUri(config), 'https://api.example.test/api/v1/me')
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  await client.get('/api/v1/me')
})

test('rejects absolute, out-of-scope and traversal URLs before requesting a token', async () => {
  let tokenCalls = 0
  const { client, sent } = fixture({ getAccessToken: async () => { tokenCalls += 1; return 'token' } })
  for (const url of [
    'https://outside.example/api/v1/me', '//outside.example/api/v1/me',
    '/core/v1/instances', '/api/v1', '/api/v10/me',
    '/api/v1/../../../identity', '/api/v1/%2e%2e/%2e%2e/identity',
    '/api/v1/\\outside', '/api/v1/me#fragment',
  ]) {
    await assert.rejects(client.get(url), (error) => error instanceof ApiError && error.code === 'INVALID_API_REQUEST')
  }
  await assert.rejects(client.get('/api/v1/me', { baseURL: 'https://outside.example' }), /cấu hình API/)
  await assert.rejects(client.get('/api/v1/me', { auth: { username: 'ignored', password: 'ignored' } }), /cấu hình API/)
  assert.equal(tokenCalls, 0)
  assert.equal(sent.length, 0)
})

test('token rejection is sanitized and sends no HTTP request', async () => {
  const { client, sent } = fixture({ getAccessToken: async () => { throw new Error('private refresh detail') } })
  await assert.rejects(client.get('/api/v1/me'), (error) => {
    assert.equal(error.kind, 'auth')
    assert.equal(error.code, 'AUTHENTICATION_REQUIRED')
    assert.equal(error.status, null)
    assert.doesNotMatch(error.message, /private/)
    assert.equal(error.config, undefined)
    return true
  })
  assert.equal(sent.length, 0)
})

test('empty token is rejected without sending a request', async () => {
  const { client, sent } = fixture({ getAccessToken: async () => '' })
  await assert.rejects(client.get('/api/v1/me'), { code: 'AUTHENTICATION_REQUIRED' })
  assert.equal(sent.length, 0)
})

test('valid JSON error preserves code and body request ID, without raw sensitive data', async () => {
  const { client } = fixture({ adapter: httpFailure(409, {
    error: { code: 'VERSION_CONFLICT', message: 'private server content' },
    request_id: 'body-id', secret: 'private payload',
  }, { 'X-Request-ID': 'header-id' }) })
  await assert.rejects(client.post('/api/v1/workspaces/demo/cases', { private: 'payload' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 409)
    assert.equal(error.code, 'VERSION_CONFLICT')
    assert.equal(error.requestId, 'body-id')
    for (const field of ['config', 'request', 'response', 'cause']) assert.equal(error[field], undefined)
    assert.doesNotMatch(JSON.stringify(error), /test-access-token|private/)
    assert.doesNotMatch(error.message, /private/)
    return true
  })
})

test('HTTP error body strings are parsed by Axios before normalization', async () => {
  const { client } = fixture({ adapter: httpFailure(422,
    JSON.stringify({ error: { code: 'GUARD_FAILED' }, request_id: 'json-id' }),
    { 'Content-Type': 'application/json' }) })
  await assert.rejects(client.get('/api/v1/me'), { status: 422, code: 'GUARD_FAILED', requestId: 'json-id' })
})

test('HTML, malformed JSON and invalid body schemas keep the HTTP status and header ID', async () => {
  for (const [status, body, contentType] of [
    [502, '<html>private proxy failure</html>', 'text/html'],
    [413, '{broken-json', 'application/json'],
    [504, ['unexpected-shape'], 'application/json'],
    [503, { error: { code: '<script>bad</script>' }, request_id: {} }, 'application/json'],
  ]) {
    const { client } = fixture({ adapter: httpFailure(status, body,
      { 'X-Request-ID': 'proxy-id', 'Content-Type': contentType }) })
    await assert.rejects(client.get('/api/v1/me'), (error) => {
      assert.equal(error.status, status)
      assert.equal(error.code, `HTTP_${status}`)
      assert.equal(error.requestId, 'proxy-id')
      assert.doesNotMatch(error.message, /html|broken-json|script|private/)
      return true
    })
  }
})

test('valid code survives an invalid request ID; invalid or absent IDs become null', async () => {
  const { client } = fixture({ adapter: httpFailure(422,
    { error: { code: 'GUARD_FAILED' }, request_id: '' }, { 'X-Request-ID': 'unsafe value' }) })
  await assert.rejects(client.get('/api/v1/me'), { code: 'GUARD_FAILED', requestId: null })
  const noId = fixture({ adapter: httpFailure(404, {}) })
  await assert.rejects(noId.client.get('/api/v1/me'), { status: 404, requestId: null })
})

test('401 and 403 stay distinct and neither is retried', async () => {
  for (const [status, code, kind] of [[401, 'INVALID_TOKEN', 'auth'], [403, 'FORBIDDEN', 'http']]) {
    let tokenCalls = 0
    const { client, sent } = fixture({
      getAccessToken: async () => { tokenCalls += 1; return 'token' },
      adapter: httpFailure(status, { error: { code } }),
    })
    await assert.rejects(client.get('/api/v1/me'), { status, code, kind })
    assert.equal(sent.length, 1)
    assert.equal(tokenCalls, 1)
  }
})

test('network, timeout and preparation errors are classified without HTTP response', async () => {
  for (const [code, request, kind, normalizedCode] of [
    ['ERR_NETWORK', undefined, 'network', 'NETWORK_ERROR'],
    ['ECONNRESET', {}, 'network', 'NETWORK_ERROR'],
    ['ECONNABORTED', {}, 'timeout', 'TIMEOUT'],
    ['ETIMEDOUT', {}, 'timeout', 'TIMEOUT'],
    ['ERR_BAD_OPTION', undefined, 'client', 'CLIENT_ERROR'],
  ]) {
    const { client } = fixture({ adapter: (config) => { throw new AxiosError('private', code, config, request) } })
    await assert.rejects(client.get('/api/v1/me'), (error) => {
      assert.equal(error.kind, kind)
      assert.equal(error.code, normalizedCode)
      assert.equal(error.status, null)
      assert.equal(error.requestId, null)
      assert.doesNotMatch(error.message, /CORS|private/)
      return true
    })
  }
})

test('pre-aborted request skips both token provider and HTTP adapter', async () => {
  let tokenCalls = 0
  const { client, sent } = fixture({ getAccessToken: async () => { tokenCalls += 1; return 'token' } })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(client.get('/api/v1/me', { signal: controller.signal }), axios.isCancel)
  assert.equal(sent.length, 0)
  assert.equal(tokenCalls, 0)
})

test('cancel while waiting for shared refresh settles immediately; other requests proceed', async () => {
  const sharedRefresh = deferred()
  const started = deferred()
  const { client, sent } = fixture({ getAccessToken: () => { started.resolve(); return sharedRefresh.promise } })
  const controller = new AbortController()
  const canceled = client.get('/api/v1/me', { signal: controller.signal })
  const rejection = assert.rejects(canceled, axios.isCancel)
  const active = client.get('/api/v1/workspaces/demo/sources')
  await started.promise
  controller.abort()
  await rejection
  assert.equal(sent.length, 0)
  sharedRefresh.resolve('new-token')
  await active
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, '/api/v1/workspaces/demo/sources')
})

test('refresh failure after request cancellation does not leak an unhandled rejection', async () => {
  const token = deferred()
  const started = deferred()
  const { client, sent } = fixture({ getAccessToken: () => { started.resolve(); return token.promise } })
  const controller = new AbortController()
  const pending = client.get('/api/v1/me', { signal: controller.signal })
  const rejection = assert.rejects(pending, axios.isCancel)
  await started.promise
  controller.abort()
  await rejection
  token.reject(new Error('refresh failed later'))
  await setImmediate()
  assert.equal(sent.length, 0)
})

test('cancellation while HTTP is in flight stays identifiable by axios.isCancel', async () => {
  const started = deferred()
  const { client, sent } = fixture({ adapter: (config) => new Promise((resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(new CanceledError('Request canceled')), { once: true })
    started.resolve()
  }) })
  const controller = new AbortController()
  const pending = client.post('/api/v1/workspaces/demo/cases', { title: 'draft' }, { signal: controller.signal })
  const rejection = assert.rejects(pending, axios.isCancel)
  await started.promise
  controller.abort()
  await rejection
  assert.equal(sent.length, 1)
})

test('POST timeout sends once, keeping the original JSON body and idempotency key', async () => {
  const { client, sent } = fixture({ adapter: (config) => { throw new AxiosError('timeout', 'ETIMEDOUT', config, {}) } })
  const body = { run_id: 'example-run', title: 'draft' }
  await assert.rejects(client.post('/api/v1/workspaces/demo/cases', body,
    { headers: { 'Idempotency-Key': 'original-key' } }), { kind: 'timeout' })
  assert.equal(sent.length, 1)
  assert.deepEqual(JSON.parse(sent[0].data), body)
  assert.equal(sent[0].headers.get('Idempotency-Key'), 'original-key')
  assert.equal(sent[0].headers.get('Content-Type'), 'application/json')
})
