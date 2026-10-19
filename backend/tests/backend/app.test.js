import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createApp } from '../../src/app.js';

async function serve(t, checkReadiness) {
  const server = createApp({ checkReadiness }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

test('liveness stays available when DB fails; readiness returns sanitized 503', async (t) => {
  const url = await serve(t, async () => { throw new Error('postgres://secret-password@private-host'); });
  const live = await fetch(`${url}/health/live`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: 'ok' });
  const ready = await fetch(`${url}/health/ready`);
  const body = await ready.json();
  assert.equal(ready.status, 503);
  assert.equal(body.error.code, 'CORE_NOT_READY');
  assert.equal(body.request_id, ready.headers.get('x-request-id'));
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(body).includes('secret-password'));
  assert.equal(ready.headers.get('cache-control'), 'no-store');
  assert.equal(ready.headers.get('x-powered-by'), null);
});

test('ready status matches the foundation contract', async (t) => {
  const contract = JSON.parse(await readFile(new URL('../../contracts/health.openapi.json', import.meta.url)));
  const url = await serve(t, async () => true);
  const response = await fetch(`${url}/health/ready`);
  const schema = contract.paths['/health/ready'].get.responses['200'].content['application/json'].schema;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: schema.properties.status.const });
});

test('malformed/oversized bodies get JSON errors without reflecting payload or client request ID', async (t) => {
  const url = await serve(t, async () => false);
  for (const [payload, status, code] of [
    ['{"password":"private-secret"', 400, 'INVALID_JSON'],
    [JSON.stringify({ data: 'x'.repeat(1048576) }), 413, 'PAYLOAD_TOO_LARGE'],
  ]) {
    const response = await fetch(`${url}/api/v1/not-implemented`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'untrusted-id' }, body: payload,
    });
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.error.code, code);
    assert.notEqual(body.request_id, 'untrusted-id');
    assert.ok(!JSON.stringify(body).includes('private-secret'));
  }
});

test('unimplemented business endpoint returns 404 instead of fabricated data', async (t) => {
  const url = await serve(t, async () => false);
  const response = await fetch(`${url}/api/v1/me`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});
