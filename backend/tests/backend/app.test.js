// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
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
  const response = await fetch(`${url}/api/v1/runs`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('Swagger serves local assets/specs/schema refs without auth or external validation', async (t) => {
  const url = await serve(t, async () => false);
  const response = await fetch(`${url}/docs`);
  assert.equal(response.status, 200); assert.match(await response.text(), /TraceWeaver Swagger UI/);
  for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'oauth2-redirect.html', 'initializer.js', 'openapi.json', 'health.openapi.json', 'schemas/domain.schema.json']) {
    const asset = await fetch(`${url}/docs/${file}`);
    assert.equal(asset.status, 200, file); await asset.arrayBuffer();
  }
  const spec = await (await fetch(`${url}/docs/openapi.json`)).json();
  assert.deepEqual(spec.servers, [{ url: '/' }]);
  assert.equal(spec.jsonSchemaDialect, undefined);
  assert.match(spec.components.securitySchemes.keycloakLogin.flows.authorizationCode.authorizationUrl, /localhost:8081\/realms\/traceweaver/);
  assert.ok(spec.paths['/api/v1/me'].get.security.some((rule) => Object.hasOwn(rule, 'keycloakLogin')));
  assert.equal(spec.paths['/api/v1/workspaces/{wid}/sources/{sid}/events:batch'].post.security.some((rule) => Object.hasOwn(rule, 'keycloakLogin')), false);
  assert.match(spec.paths['/api/v1/me'].get.summary, /implemented/);
  assert.match(spec.paths['/api/v1/workspaces/{wid}/runs'].post.summary, /implemented/);
  assert.match(spec.paths['/api/v1/workspaces/{wid}/cases'].post.summary, /implemented/);
  assert.match(spec.paths['/core/v1/instances'].post.summary, /planned/);
  const init = await (await fetch(`${url}/docs/initializer.js`)).text();
  assert.match(init, /validatorUrl:null/); assert.match(init, /persistAuthorization:false/);
  assert.match(init, /usePkceWithAuthorizationCodeGrant.*true/);
  assert.equal((await fetch(`${url}/api/v1/me`)).status, 401);
  assert.equal((await fetch(`${url}/docs/package.json`)).status, 404);
});

test('Swagger OAuth callback loads its script and hands the authorization code back to its opener', async (t) => {
  const base = await serve(t, async () => false);
  const callback = new URL('/docs/oauth2-redirect.html', base);
  const html = await (await fetch(callback)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => new URL(match[1], callback));
  assert.ok(scripts.length, 'callback script dependency');
  const returned = [], errors = []; let closed = false;
  const location = { hash: '', search: '?state=demo-state&code=demo-authorization-code' };
  const window = { location, close: () => { closed = true; }, opener: { swaggerUIRedirectOauth2: {
    state: 'demo-state', redirectUrl: callback.href, auth: { name: 'keycloakLogin', schema: { get: () => 'authorizationCode' } },
    callback: (result) => returned.push(result), errCb: (error) => errors.push(error),
  } } };
  for (const url of scripts) {
    const script = await fetch(url); assert.equal(script.status, 200, `callback dependency ${url.pathname}`);
    assert.match(script.headers.get('content-type'), /javascript/);
    runInNewContext(await script.text(), { window, location, document: { readyState: 'complete' } });
  }
  assert.equal(returned.length, 1); assert.equal(returned[0].auth.code, 'demo-authorization-code');
  assert.equal(errors.length, 0); assert.equal(closed, true);
});
