// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { createAccountProvider } from '../../src/core/identity/account-provider.js';
import { createAdminService } from '../../src/services/admin.service.js';
import { adminInput } from '../../src/validations/admin.validation.js';
import { createServer } from 'node:http';
import { readConfig } from '../../src/config.js';
test('account client configuration is opt-in, paired and does not expose bad secret values', () => {
  const env = { DATABASE_URL: 'postgresql://u:p@localhost/db', CURSOR_SECRET: 'x'.repeat(32) };
  assert.equal(readConfig(env).accountClientId, '');
  for (const patch of [{ ACCOUNT_ADMIN_CLIENT_ID: 'svc' }, { ACCOUNT_ADMIN_CLIENT_SECRET: 'secret-only' },
    { ACCOUNT_ADMIN_CLIENT_ID: 'svc', ACCOUNT_ADMIN_CLIENT_SECRET: 'private-bad-secret' }]) {
    assert.throws(() => readConfig({ ...env, ...patch }), e => !e.message.includes('private-bad-secret'));
  }
});
test('account admin endpoint permits only HTTPS or the exact private Keycloak route in production', () => {
  const env = { APP_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', CURSOR_SECRET: 'x'.repeat(32), OIDC_ISSUER: 'https://idp.example.test/identity/realms/traceweaver' };
  const internal = 'http://keycloak:8080/identity/admin/realms/traceweaver';
  assert.equal(readConfig({ ...env, ACCOUNT_ADMIN_BASE_URL: internal }).accountAdminBaseUrl, internal);
  for (const value of ['http://evil.test/admin', internal + '?key=secret', internal.replace('keycloak', 'other'), internal.replace('traceweaver', 'master')])
    assert.throws(() => readConfig({ ...env, ACCOUNT_ADMIN_BASE_URL: value }), /ACCOUNT_ADMIN_BASE_URL/);
});

test('private admin route preserves the canonical token issuer and avoids public admin REST', async () => {
  const urls = [];
  const provider = createAccountProvider({ oidcIssuer: 'https://idp.example.test/identity/realms/traceweaver', accountClientId: 'svc', accountClientSecret: 'x'.repeat(32),
    accountAdminBaseUrl: 'http://keycloak:8080/identity/admin/realms/traceweaver' }, async url => {
    urls.push(url);
    return url.endsWith('/token') ? Response.json({ access_token: 'private-token' }) : Response.json({ id: 'person', username: 'person', enabled: true });
  });
  assert.equal((await provider.existing('person')).subject, 'person');
  assert.deepEqual(urls, ['https://idp.example.test/identity/realms/traceweaver/protocol/openid-connect/token', 'http://keycloak:8080/identity/admin/realms/traceweaver/users/person']);
});

test('account adapter exercises real HTTP serialization, ownership replay and upstream failure sanitization', async t => {
  let stored, failure = false;
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (failure) { res.writeHead(500); res.end('private-provider-error'); return; }
    if (req.url.endsWith('/token')) { res.end(JSON.stringify({ access_token: 'server-token' })); return; }
    assert.equal(req.headers.authorization, 'Bearer server-token');
    if (req.method === 'POST') {
      let body = ''; for await (const part of req) body += part;
      const input = JSON.parse(body);
      res.writeHead(stored ? 409 : 201);
      stored ??= { ...input, id: 'created-person' }; res.end('{}'); return;
    }
    res.end(JSON.stringify(req.url.includes('?') ? [stored] : stored));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const provider = createAccountProvider({ oidcIssuer: `http://127.0.0.1:${server.address().port}/realms/test`, accountClientId: 'svc', accountClientSecret: 'x'.repeat(32) });
  const first = await provider.create('new.person', 'synthetic-password', 'owned');
  assert.equal(first.subject, 'created-person');
  assert.deepEqual(await provider.create('new.person', 'synthetic-password', 'owned'), first);
  failure = true;
  await assert.rejects(provider.existing(first.subject), e => e.status === 503 && !e.message.includes('private-provider-error'));
});
test('admin validation rejects self-asserted identity/provider fields and service roles', () => {
  const valid = { subject: 'person', roles: ['viewer'], expected_version: 1 };
  for (const body of [{ ...valid, actor: 'admin' }, { ...valid, roles: ['ingest_service'] }, { ...valid, roles: [] }, { ...valid, expected_version: 0 }])
    assert.throws(() => adminInput('add', body), e => e.status === 400);
  assert.throws(() => adminInput('account', { username: 'service-account-reserved', temporary_password: 'synthetic-password', roles: ['viewer'], expected_version: 1 }), e => e.status === 400);
});
test('account provider uses temporary passwords and refuses adoption/reset of unrelated accounts', async () => {
  let creates = 0, posted;
  const config = { oidcIssuer: 'https://idp.example.test/identity/realms/test', accountClientId: 'admin-service', accountClientSecret: 'x'.repeat(32) };
  const marker = 'owned-operation';
  let ownership = marker;
  const provider = createAccountProvider(config, async (url, options) => {
    if (url.endsWith('/token')) return Response.json({ access_token: 'server-private-token' });
    if (url.endsWith('/users') && options.method === 'POST') { creates++; posted = JSON.parse(options.body); return new Response(null, { status: creates === 1 ? 201 : 409 }); }
    if (url.includes('/users?')) return Response.json([{ id: 'person', username: 'new.person' }]);
    return Response.json({ id: 'person', username: 'new.person', enabled: true, attributes: { traceweaverProvisioningKey: [ownership] } });
  });
  assert.deepEqual(await provider.create('new.person', 'synthetic-password', marker), { subject: 'person', username: 'new.person' });
  assert.equal(posted.credentials[0].temporary, true);
  assert.ok(posted.requiredActions.includes('UPDATE_PASSWORD'));
  await provider.create('new.person', 'synthetic-password', marker);
  ownership = 'unrelated';
  await assert.rejects(provider.create('new.person', 'synthetic-password', marker), e => e.code === 'ACCOUNT_OWNERSHIP_CONFLICT');
  assert.equal(createAccountProvider({}), null);
});
test('admin HTTP authenticates, validates bound IDs and never reflects raw provider failures', async t => {
  const service = createAdminService({ authorize: async () => {}, list: async () => ({ version: 1, items: [] }),
    add: async () => { throw Error('private-db-password'); } }, { existing: async id => ({ subject: id }) }, 'server-secret');
  const server = createApp({ verifyToken: async () => ({ subject: 'admin' }), access: {}, admin: service }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/admin/members`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { authorization: 'Bearer test', 'content-type': 'application/json' };
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal((await fetch(url + '?limit=101', { headers })).status, 400);
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ subject: 'person', roles: ['viewer'], expected_version: 1 }) });
  assert.equal(r.status, 503); assert.ok(!(await r.text()).includes('private-db-password'));
});
