// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodeJwt } from 'jose';
let step = 'configuration';
try {
  const credentials = JSON.parse(await readFile(new URL('../../demo-credentials.local.json', import.meta.url), 'utf8'));
  const issuer = process.env.OIDC_ISSUER ?? `http://localhost:${process.env.IDENTITY_PORT ?? 8081}/realms/traceweaver`;
  const api = `http://localhost:${process.env.API_PORT ?? 8080}`, redirect = `${api}/docs/oauth2-redirect.html`;
  const clientId = process.env.OIDC_CLIENT_ID ?? 'traceweaver-web';
  const discovery = await (await fetch(`${issuer}/.well-known/openid-configuration`)).json();
  assert.equal(discovery.issuer, issuer);
  for (const endpoint of [discovery.authorization_endpoint, discovery.token_endpoint]) assert.equal(new URL(endpoint).origin, new URL(issuer).origin);
  const jar = new Map();
  const remember = (response) => { for (const cookie of response.headers.getSetCookie()) { const part = cookie.split(';')[0], index = part.indexOf('='); jar.set(part.slice(0, index), part.slice(index + 1)); } };
  const cookies = () => [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
  async function authorize(user) {
    jar.clear();
    const verifier = randomBytes(32).toString('base64url'), state = randomBytes(20).toString('hex');
    const url = new URL(discovery.authorization_endpoint);
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'openid profile email', state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    const response = await fetch(url, { redirect: 'manual' }); remember(response);
    const previousStep = step; step = `${previousStep}: authorization status ${response.status}`;
    assert.equal(response.status, 200);
    const html = await response.text(), form = html.match(/<form\b[^>]*id="kc-form-login"[^>]*>/)?.[0];
    const action = form?.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    if (!action) step += `; login form absent; title=${html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'unknown'}`;
    assert.ok(action, 'login form');
    assert.equal(new URL(action).origin, new URL(issuer).origin);
    const login = await fetch(action, { method: 'POST', redirect: 'manual', headers: { Cookie: cookies(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: user.username, password: user.password, credentialId: '', login: 'Sign In' }) });
    remember(login); step = `${previousStep}: login status ${login.status}`; assert.equal(login.status, 302);
    const callback = new URL(login.headers.get('location')); assert.equal(callback.origin + callback.pathname, redirect); assert.equal(callback.searchParams.get('state'), state);
    assert.ok(callback.searchParams.get('code'));
    step = previousStep; return { code: callback.searchParams.get('code'), verifier };
  }
  async function exchange(auth, verifier = auth.verifier) {
    return fetch(discovery.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: api },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect, code: auth.code, code_verifier: verifier }) });
  }
  async function login(user) {
    const response = await exchange(await authorize(user)); assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), api);
    return response.json();
  }
  const request = async (path, token, options = {}) => {
    const response = await fetch(api + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
    return { status: response.status, body: await response.json() };
  };
  step = 'PKCE negative';
  const passwordGrant = await fetch(discovery.token_endpoint, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: clientId, username: credentials.operator.username, password: credentials.operator.password }) });
  assert.equal(passwordGrant.status, 400); assert.equal((await passwordGrant.json()).error, 'unauthorized_client');
  assert.equal((await exchange(await authorize(credentials.viewer), randomBytes(32).toString('base64url'))).status, 400);
  const noPkce = new URL(discovery.authorization_endpoint); noPkce.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'openid' }).toString();
  const rejectedPkce = await fetch(noPkce, { redirect: 'manual' });
  assert.equal(rejectedPkce.status, 302);
  const rejectedCallback = new URL(rejectedPkce.headers.get('location'));
  assert.equal(rejectedCallback.origin + rejectedCallback.pathname, redirect); assert.equal(rejectedCallback.searchParams.get('error'), 'invalid_request');
  step = 'operator login';
  const operator = await login(credentials.operator), operatorClaims = decodeJwt(operator.access_token);
  assert.equal(operatorClaims.sub, credentials.operator.subject); assert.equal(operatorClaims.azp, clientId); assert.equal(operatorClaims.iss, issuer);
  const me = await request('/api/v1/me', operator.access_token); assert.equal(me.status, 200); assert.equal(me.body.memberships[0].workspace_id, credentials.workspace_id);
  assert.deepEqual(me.body.memberships[0].roles, ['operator']);
  const base = `/api/v1/workspaces/${credentials.workspace_id}`;
  assert.equal((await request(`${base}/sources`, operator.access_token)).body.items.length, 3);
  assert.equal((await request(`${base}/knowledge`, operator.access_token)).status, 200);
  step = 'viewer login';
  const viewer = await login(credentials.viewer);
  assert.deepEqual((await request('/api/v1/me', viewer.access_token)).body.memberships[0].roles, ['viewer']);
  assert.equal((await request('/api/v1/workspaces/99999999-9999-4999-8999-999999999999/events', viewer.access_token)).status, 404);
  step = 'service credential and ingestion';
  const wrongService = await fetch(discovery.token_endpoint, { method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.ingest.clientId, client_secret: 'invalid-test-secret' }) });
  assert.equal(wrongService.status, 401);
  const serviceResponse = await fetch(discovery.token_endpoint, { method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.ingest.clientId, client_secret: credentials.ingest.clientSecret }) });
  assert.equal(serviceResponse.status, 200); const service = await serviceResponse.json();
  assert.equal(decodeJwt(service.access_token).sub, credentials.ingest.subject);
  assert.equal((await request('/api/v1/me', service.access_token)).status, 401);
  const batchPath = `${base}/sources/30000000-0000-4000-8000-000000000015/events:batch`;
  const input = { source_event_id: 'keycloak-demo-smoke-v1', occurred_at: '2026-10-21T00:00:00Z', service: 'intake', action: 'request.accepted', outcome: 'success', identifiers: [{ namespace: 'request', value: 'demo-identity' }], message: 'Demo token=synthetic-sensitive', payload: { password: 'synthetic-sensitive' } };
  assert.equal((await request(batchPath, operator.access_token, { method: 'POST', body: JSON.stringify({ events: [input] }) })).status, 401);
  const batch = await request(batchPath, service.access_token, { method: 'POST', body: JSON.stringify({ events: [input, null] }) });
  assert.equal(batch.status, 200); assert.equal(batch.body.rejected, 1); assert.equal(batch.body.accepted + batch.body.duplicate, 1);
  step = 'event read and redaction';
  const event = await request(`${base}/events/${batch.body.results[0].event_id}`, viewer.access_token);
  assert.equal(event.status, 200); assert.doesNotMatch(JSON.stringify(event.body), /synthetic-sensitive/);
  assert.equal((await request(`${base}/events?q=demo-identity`, operator.access_token)).body.items.length, 1);
  step = 'refresh';
  const refresh = await fetch(discovery.token_endpoint, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: operator.refresh_token }) });
  assert.equal(refresh.status, 200); const refreshed = await refresh.json(); assert.equal((await request('/api/v1/me', refreshed.access_token)).status, 200);
  console.log('Live Keycloak checks passed: discovery, PKCE S256/negative/CORS, operator+viewer login, refresh, /me/sources/knowledge, client separation, scoped batch ingestion/events and redaction. Tokens were not printed or saved.');
} catch { console.error(`LIVE_KEYCLOAK_VERIFY_FAILED at ${step}; credentials and tokens withheld`); process.exitCode = 1; }
