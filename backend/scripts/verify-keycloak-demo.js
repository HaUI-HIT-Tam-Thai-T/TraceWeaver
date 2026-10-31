// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodeJwt } from 'jose';
import { coreDemoTarget } from './lib/core-demo.js';
const fetch = (url, options = {}) =>
  globalThis.fetch(url, { redirect: 'error', ...options, signal: AbortSignal.timeout(10000) });
let step = 'configuration';
try {
  const credentials = JSON.parse(
    await readFile(new URL('../../demo-credentials.local.json', import.meta.url), 'utf8'),
  );
  const { issuer } = coreDemoTarget();
  const apiPort = process.env.API_PORT ?? '8080';
  assert.ok(/^\d+$/.test(apiPort) && Number(apiPort) > 0 && Number(apiPort) <= 65535);
  const api = `http://localhost:${apiPort}`,
    redirect = `${api}/docs/oauth2-redirect.html`;
  const clientId = process.env.OIDC_CLIENT_ID ?? 'traceweaver-web';
  step = 'Swagger callback assets';
  const callbackPage = await fetch(redirect);
  assert.equal(callbackPage.status, 200);
  const callbackHtml = await callbackPage.text(),
    callbackScripts = [...callbackHtml.matchAll(/<script[^>]+src="([^"]+)"/g)];
  assert.ok(callbackScripts.length);
  for (const match of callbackScripts) {
    const assetUrl = new URL(match[1], redirect);
    assert.equal(assetUrl.origin, api);
    const asset = await fetch(assetUrl);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    await asset.arrayBuffer();
  }
  const discovery = await (await fetch(`${issuer}/.well-known/openid-configuration`)).json();
  assert.equal(discovery.issuer, issuer);
  for (const endpoint of [discovery.authorization_endpoint, discovery.token_endpoint])
    assert.equal(new URL(endpoint).origin, new URL(issuer).origin);
  const jar = new Map();
  const remember = (response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(';')[0],
        index = part.indexOf('=');
      jar.set(part.slice(0, index), part.slice(index + 1));
    }
  };
  const cookies = () => [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
  async function authorize(user) {
    jar.clear();
    const verifier = randomBytes(32).toString('base64url'),
      state = randomBytes(20).toString('hex');
    const url = new URL(discovery.authorization_endpoint);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    const response = await fetch(url, { redirect: 'manual' });
    remember(response);
    const previousStep = step;
    step = `${previousStep}: authorization status ${response.status}`;
    assert.equal(response.status, 200);
    const html = await response.text(),
      form = html.match(/<form\b[^>]*id="kc-form-login"[^>]*>/)?.[0];
    const action = form?.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    if (!action)
      step += `; login form absent; title=${html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'unknown'}`;
    assert.ok(action, 'login form');
    assert.equal(new URL(action).origin, new URL(issuer).origin);
    const login = await fetch(action, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: cookies(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: user.username,
        password: user.password,
        credentialId: '',
        login: 'Sign In',
      }),
    });
    remember(login);
    step = `${previousStep}: login status ${login.status}`;
    assert.equal(login.status, 302);
    const callback = new URL(login.headers.get('location'));
    assert.equal(callback.origin + callback.pathname, redirect);
    assert.equal(callback.searchParams.get('state'), state);
    assert.ok(callback.searchParams.get('code'));
    step = previousStep;
    return { code: callback.searchParams.get('code'), verifier };
  }
  async function exchange(auth, verifier = auth.verifier) {
    return fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: api },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirect,
        code: auth.code,
        code_verifier: verifier,
      }),
    });
  }
  async function login(user) {
    const response = await exchange(await authorize(user));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), api);
    return response.json();
  }
  const request = async (path, token, options = {}) => {
    const response = await fetch(api + path, {
      ...options,
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    return { status: response.status, body: await response.json() };
  };
  step = 'PKCE negative';
  const passwordGrant = await fetch(discovery.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username: credentials.operator.username,
      password: credentials.operator.password,
    }),
  });
  assert.equal(passwordGrant.status, 400);
  assert.equal((await passwordGrant.json()).error, 'unauthorized_client');
  assert.equal(
    (await exchange(await authorize(credentials.viewer), randomBytes(32).toString('base64url')))
      .status,
    400,
  );
  const noPkce = new URL(discovery.authorization_endpoint);
  noPkce.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid',
  }).toString();
  const rejectedPkce = await fetch(noPkce, { redirect: 'manual' });
  assert.equal(rejectedPkce.status, 302);
  const rejectedCallback = new URL(rejectedPkce.headers.get('location'));
  assert.equal(rejectedCallback.origin + rejectedCallback.pathname, redirect);
  assert.equal(rejectedCallback.searchParams.get('error'), 'invalid_request');
  step = 'operator login';
  const operator = await login(credentials.operator),
    operatorClaims = decodeJwt(operator.access_token);
  assert.equal(operatorClaims.sub, credentials.operator.subject);
  assert.equal(operatorClaims.azp, clientId);
  assert.equal(operatorClaims.iss, issuer);
  const me = await request('/api/v1/me', operator.access_token);
  assert.equal(me.status, 200);
  assert.equal(me.body.memberships[0].workspace_id, credentials.workspace_id);
  assert.deepEqual(me.body.memberships[0].roles, ['operator']);
  const base = `/api/v1/workspaces/${credentials.workspace_id}`;
  assert.equal((await request(`${base}/sources`, operator.access_token)).body.items.length, 3);
  assert.equal((await request(`${base}/knowledge`, operator.access_token)).status, 200);
  step = 'viewer login';
  const viewer = await login(credentials.viewer);
  assert.deepEqual((await request('/api/v1/me', viewer.access_token)).body.memberships[0].roles, [
    'viewer',
  ]);
  assert.equal(
    (
      await request(
        '/api/v1/workspaces/99999999-9999-4999-8999-999999999999/events',
        viewer.access_token,
      )
    ).status,
    404,
  );
  step = 'service credential and ingestion';
  const wrongService = await fetch(discovery.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.ingest.clientId,
      client_secret: 'invalid-test-secret',
    }),
  });
  assert.equal(wrongService.status, 401);
  const serviceResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.ingest.clientId,
      client_secret: credentials.ingest.clientSecret,
    }),
  });
  assert.equal(serviceResponse.status, 200);
  const service = await serviceResponse.json();
  assert.equal(decodeJwt(service.access_token).sub, credentials.ingest.subject);
  assert.equal((await request('/api/v1/me', service.access_token)).status, 401);
  const batchPath = `${base}/sources/30000000-0000-4000-8000-000000000015/events:batch`;
  const input = {
    source_event_id: 'keycloak-demo-smoke-v1',
    occurred_at: '2026-10-21T00:00:00Z',
    service: 'intake',
    action: 'request.accepted',
    outcome: 'success',
    identifiers: [{ namespace: 'request', value: 'demo-identity' }],
    message: 'Demo token=synthetic-sensitive',
    payload: { password: 'synthetic-sensitive' },
  };
  assert.equal(
    (
      await request(batchPath, operator.access_token, {
        method: 'POST',
        body: JSON.stringify({ events: [input] }),
      })
    ).status,
    401,
  );
  const batch = await request(batchPath, service.access_token, {
    method: 'POST',
    body: JSON.stringify({ events: [input, null] }),
  });
  assert.equal(batch.status, 200);
  assert.equal(batch.body.rejected, 1);
  assert.equal(batch.body.accepted + batch.body.duplicate, 1);
  step = 'event read and redaction';
  const event = await request(
    `${base}/events/${batch.body.results[0].event_id}`,
    viewer.access_token,
  );
  assert.equal(event.status, 200);
  assert.doesNotMatch(JSON.stringify(event.body), /synthetic-sensitive/);
  assert.equal(
    (await request(`${base}/events?q=demo-identity`, operator.access_token)).body.items.length,
    1,
  );
  step = 'refresh';
  const refresh = await fetch(discovery.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: operator.refresh_token,
    }),
  });
  assert.equal(refresh.status, 200);
  const refreshed = await refresh.json();
  assert.equal((await request('/api/v1/me', refreshed.access_token)).status, 200);
  step = 'core service credential';
  assert.equal(credentials.core?.clientId, 'traceweaver-core');
  assert.equal(process.env.CORE_APP_CLIENT_ID, credentials.core.clientId);
  assert.equal(process.env.CORE_APP_SUBJECT, credentials.core.subject);
  const coreGrant = (clientSecret) =>
    fetch(discovery.token_endpoint, {
      method: 'POST',
      redirect: 'error',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.core.clientId,
        client_secret: clientSecret,
      }),
    });
  assert.equal((await coreGrant('invalid-test-secret')).status, 401);
  const coreResponse = await coreGrant(credentials.core.clientSecret);
  assert.equal(coreResponse.status, 200);
  const core = await coreResponse.json(),
    coreClaims = decodeJwt(core.access_token);
  assert.equal(coreClaims.sub, credentials.core.subject);
  assert.equal(coreClaims.azp, credentials.core.clientId);
  assert.equal(coreClaims.iss, issuer);
  const corePath = '/core/v1/instances';
  const coreRequest = (path, userToken, options = {}, appToken = core.access_token) =>
    request(corePath + path, appToken, {
      ...options,
      headers: {
        'X-Workspace-Id': credentials.workspace_id,
        'X-End-User-Authorization': `Bearer ${userToken}`,
        'X-Actor-Subject': credentials.operator.subject,
        ...options.headers,
      },
    });
  const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });
  const transition = (action, expected_version, extra = {}) => ({
    action,
    expected_version,
    reason: `Live delegated ${action}`,
    evidence_refs: [],
    ...extra,
  });
  step = 'core client isolation';
  assert.equal((await request('/api/v1/me', core.access_token)).status, 401);
  assert.equal(
    (await request(batchPath, core.access_token, post({ events: [input] }))).status,
    401,
  );
  const documentInput = {
    definition_key: 'document_review',
    definition_version: 1,
    entity_ref: { type: 'document', id: randomUUID() },
    workspace_id: credentials.workspace_id,
    creator_subject: credentials.operator.subject,
  };
  assert.equal(
    (
      await request(corePath, core.access_token, {
        ...post(documentInput),
        headers: { 'X-Workspace-Id': credentials.workspace_id },
      })
    ).status,
    401,
  );
  for (const wrongApp of [operator.access_token, service.access_token])
    assert.equal(
      (await coreRequest('', operator.access_token, post(documentInput), wrongApp)).status,
      401,
    );
  assert.equal((await coreRequest('', core.access_token, post(documentInput))).status, 401);
  assert.equal(
    (
      await coreRequest(
        '',
        operator.access_token,
        post({ ...documentInput, creator_subject: credentials.viewer.subject }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await coreRequest(
        '',
        viewer.access_token,
        post({ ...documentInput, creator_subject: credentials.viewer.subject }),
      )
    ).status,
    403,
  );
  step = 'core document workflow';
  const createdDocument = await coreRequest('', operator.access_token, post(documentInput));
  assert.equal(createdDocument.status, 201);
  const document = createdDocument.body;
  assert.equal(document.state, 'draft');
  assert.equal(document.history[0].actor_subject, credentials.operator.subject);
  assert.equal((await coreRequest('', operator.access_token, post(documentInput))).status, 409);
  assert.equal((await coreRequest(`/${document.id}`, viewer.access_token)).status, 200);
  assert.equal(
    (
      await coreRequest(`/${document.id}`, operator.access_token, {
        headers: { 'X-Workspace-Id': '99999999-9999-4999-8999-999999999999' },
      })
    ).status,
    404,
  );
  const submitted = await coreRequest(
    `/${document.id}/transitions`,
    operator.access_token,
    post(transition('submit', 1)),
  );
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.state, 'in_review');
  assert.equal(submitted.body.history.length, 2);
  assert.equal(
    (
      await coreRequest(
        `/${document.id}/transitions`,
        operator.access_token,
        post(transition('submit', 1)),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await coreRequest(
        `/${document.id}/transitions`,
        operator.access_token,
        post(transition('approve', 2)),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await coreRequest(
        `/${document.id}/transitions`,
        viewer.access_token,
        post(transition('approve', 2)),
      )
    ).status,
    403,
  );
  step = 'core case workflow and evidence guard';
  const runResponse = await request(`${base}/runs`, operator.access_token, {
    ...post({
      root_event_id: event.body.event_id,
      source_ids: [
        '30000000-0000-4000-8000-000000000015',
        '30000000-0000-4000-8000-000000000016',
        '30000000-0000-4000-8000-000000000017',
      ],
      mode: 'rule_only',
      window: { from: '2026-10-21T00:00:00Z', to: '2026-10-21T00:01:00Z' },
    }),
    headers: { 'Idempotency-Key': 'live-core-run-v1' },
  });
  assert.equal(runResponse.status, 202);
  const createdCase = await request(
    `${base}/cases`,
    operator.access_token,
    post({ run_id: runResponse.body.id, title: 'Live core delegation check' }),
  );
  assert.equal(createdCase.status, 201);
  const caseId = createdCase.body.id,
    caseInstance = createdCase.body.workflow_instance_id;
  const caseWorkflow = await coreRequest(`/${caseInstance}`, viewer.access_token);
  assert.equal(caseWorkflow.status, 200);
  assert.equal(caseWorkflow.body.definition_key, 'case_handling');
  assert.equal(
    (
      await coreRequest(
        `/${caseInstance}/transitions`,
        operator.access_token,
        post(transition('assign', 1, { owner_subject: credentials.operator.subject })),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await coreRequest(
        `/${caseInstance}/transitions`,
        operator.access_token,
        post(transition('start', 2)),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await coreRequest(
        `/${caseInstance}/transitions`,
        operator.access_token,
        post(transition('request_verification', 3)),
      )
    ).status,
    422,
  );
  const addedEvidence = await request(
    `${base}/cases/${caseId}/evidence`,
    operator.access_token,
    post({ kind: 'note', event_ids: [], note: 'Verified live delegated case workflow' }),
  );
  assert.equal(addedEvidence.status, 201);
  const awaiting = await coreRequest(
    `/${caseInstance}/transitions`,
    operator.access_token,
    post(transition('request_verification', 3, { evidence_refs: [addedEvidence.body.id] })),
  );
  assert.equal(awaiting.status, 200);
  assert.equal(awaiting.body.state, 'awaiting_verification');
  assert.equal(awaiting.body.history.at(-1).actor_subject, credentials.operator.subject);
  assert.equal(
    (await request(`${base}/cases/${caseId}`, viewer.access_token)).body.case.state,
    'awaiting_verification',
  );
  console.log(
    'Live Keycloak checks passed: discovery, PKCE S256/negative/CORS, operator+viewer login, refresh, scoped ingestion/events/redaction; core app/user/ingest isolation, document+case workflows, role/version/evidence guards and shared case history. Tokens were not printed or saved; workflow smoke artifacts retained.',
  );
} catch {
  console.error(`LIVE_KEYCLOAK_VERIFY_FAILED at ${step}; credentials and tokens withheld`);
  process.exitCode = 1;
}
