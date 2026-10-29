// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';

test('browser origins use exact allowlists; preflights do not bypass authentication or expose core', async (t) => {
  const origin = 'http://localhost:3000';
  const server = createApp({ frontendOrigins: [origin], checkReadiness: async () => true }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const preflight = (patch = {}, path = '/api/v1/me') => fetch(base + path, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type', ...patch,
  } });
  const allowed = await preflight(); assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  assert.match(allowed.headers.get('vary'), /Origin/);
  for (const patch of [{ Origin: origin + '.evil.test' }, { 'Access-Control-Request-Method': 'DELETE' },
    { 'Access-Control-Request-Headers': 'x-end-user-authorization' }]) assert.equal((await preflight(patch)).status, 403);
  const anonymous = await fetch(base + '/api/v1/me', { headers: { Origin: origin } });
  assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get('access-control-allow-origin'), origin);
  assert.match(anonymous.headers.get('access-control-expose-headers'), /X-Request-ID/);
  assert.equal((await preflight({}, '/core/v1/instances')).headers.get('access-control-allow-origin'), null);
});

test('frontend origin config rejects wildcards/paths/nonlocal HTTP and defaults closed in production', () => {
  const env = { DATABASE_URL: 'postgresql://test:test@localhost/db', CURSOR_SECRET: 'x'.repeat(32) };
  assert.deepEqual(readConfig({ ...env, FRONTEND_PORT: '3333' }).frontendOrigins, ['http://localhost:3333', 'http://127.0.0.1:3333']);
  for (const FRONTEND_ORIGINS of ['*', 'https://*.example.test', 'http://evil.test', 'http://localhost:3000/callback', 'https://user:pass@example.test']) {
    assert.throws(() => readConfig({ ...env, FRONTEND_ORIGINS }), /FRONTEND_ORIGINS/);
  }
  const production = { ...env, APP_ENV: 'production', OIDC_ISSUER: 'https://identity.example.test/realm' };
  assert.deepEqual(readConfig(production).frontendOrigins, []);
  assert.throws(() => readConfig({ ...production, FRONTEND_ORIGINS: 'http://localhost:3000' }), /FRONTEND_ORIGINS/);
});
