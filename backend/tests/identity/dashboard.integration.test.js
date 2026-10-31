// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { caseFixture } from '../support/case-fixture.js';
import { identitySimulation } from '../support/oidc-simulation.js';
import { createApp } from '../../src/app.js';
import { createTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createAccessRepository } from '../../src/core/identity/access-repository.js';
import { createCursorCodec } from '../../src/core/identity/cursor.js';
import { createCaseService } from '../../src/services/case.service.js';
import { createDashboardRepository } from '../../src/core/data/dashboard-repository.js';
import { createDashboardService } from '../../src/services/dashboard.service.js';

test('dashboard HTTP authenticates, scopes counters and shares exact case drill-down filters', async (t) => {
  const f = await caseFixture(t),
    { pool, workspace } = f,
    sim = await identitySimulation(t);
  const server = createApp({
    checkReadiness: async () => true,
    access: {},
    verifyToken: createTokenVerifier(sim.config),
    cases: createCaseService(
      f.cases,
      createAccessRepository(pool),
      createCursorCodec(f.config.cursorSecret),
    ),
    dashboard: createDashboardService(createDashboardRepository(pool)),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}`,
    tokens = {};
  for (const sub of ['viewer', 'operator', 'writer', 'outsider'])
    tokens[sub] = await sim.token({ sub });
  const request = async (path, bearer = tokens.viewer) => {
    const response = await fetch(base + path, {
      headers: {
        'X-Actor-Subject': 'operator',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    });
    return { status: response.status, body: await response.json() };
  };
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const valid = ajv.getSchema(`${schema.$id}#/$defs/Dashboard`);
  for (let i = 0; i < 3; i++)
    await f.cases.create('operator', workspace, { run_id: f.run.id, title: `Waiting ${i}` });
  const totals = await request('/dashboard');
  assert.equal(totals.status, 200);
  assert.equal(valid(totals.body), true, JSON.stringify(valid.errors));
  assert.deepEqual(totals.body, {
    runs: 1,
    degraded_runs: 0,
    unresolved_events: 1,
    waiting_cases: 3,
    filters: {},
  });
  const time = f.run.created_at,
    range = `from=${time}&to=${time}`;
  assert.deepEqual((await request(`/dashboard?${range}`)).body, {
    ...totals.body,
    filters: { from: time, to: time },
  });
  const first = await request(`/cases?state=new&limit=1&${range}`);
  assert.equal(first.status, 200);
  assert.equal(first.body.items.length, 1);
  assert.ok(first.body.next_cursor);
  const cursor = encodeURIComponent(first.body.next_cursor);
  const next = await request(`/cases?state=new&limit=1&${range}&cursor=${cursor}`);
  assert.equal(next.status, 200);
  assert.notEqual(next.body.items[0].id, first.body.items[0].id);
  for (const changed of [
    `from=2020-01-01T00:00:00Z&to=${time}`,
    `from=${time}&to=2099-01-01T00:00:00Z`,
    '',
  ]) {
    assert.equal(
      (await request(`/cases?state=new&limit=1&${changed}&cursor=${cursor}`)).status,
      400,
    );
  }
  const after = time.slice(0, -1) + '0001Z';
  assert.equal((await request(`/dashboard?from=${after}`)).body.waiting_cases, 0);
  assert.deepEqual((await request(`/cases?state=new&from=${after}`)).body.items, []);
  for (const path of [
    '/dashboard?from=x',
    `/dashboard?from=${time}&from=${time}`,
    '/dashboard?source_id=hidden',
    `/dashboard?from=${after}&to=${time}`,
    '/cases?from=bad',
    `/cases?to=${time}&to=${time}`,
  ]) {
    assert.equal((await request(path)).status, 400, path);
  }
  for (const bearer of [
    null,
    'bad',
    await sim.token({ sub: 'viewer', azp: 'traceweaver-ingest' }),
  ]) {
    assert.equal((await request('/dashboard', bearer)).status, 401);
  }
  assert.equal((await request('/dashboard', tokens.outsider)).status, 404);
  assert.equal((await request('/dashboard', tokens.writer)).status, 403);
  await pool.query(
    `UPDATE core.source_grants SET revoked_at=now() WHERE grantee_subject='viewer' AND source_id=$1`,
    [f.sources[2]],
  );
  assert.deepEqual((await request('/dashboard')).body, {
    ...totals.body,
    runs: 0,
    unresolved_events: 0,
    waiting_cases: 0,
  });
  assert.deepEqual((await request('/cases')).body.items, []);
  assert.equal((await request(`/cases?state=new&limit=1&${range}&cursor=${cursor}`)).status, 400);
  await pool.query(`UPDATE core.memberships SET revoked_at=now() WHERE subject='viewer'`);
  assert.equal((await request('/dashboard')).status, 404);
  await sim.waitForRequest();
});
