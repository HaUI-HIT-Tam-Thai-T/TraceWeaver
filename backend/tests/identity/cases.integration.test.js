// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
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
import { createRunService } from '../../src/services/run.service.js';
import { createReviewService } from '../../src/services/review.service.js';

test('case APIs: real JWT/JWKS/HTTP/PostgreSQL workflow, evidence protection, cursor and replay', async (t) => {
  const f = await caseFixture(t),
    { workspace, pool } = f,
    sim = await identitySimulation(t);
  const cases = createCaseService(
    f.cases,
    createAccessRepository(pool),
    createCursorCodec(f.config.cursorSecret),
  );
  const server = createApp({
    checkReadiness: async () => true,
    access: {},
    verifyToken: createTokenVerifier(sim.config),
    cases,
    runs: createRunService(f.runs),
    reviews: createReviewService(f.reviews),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}`,
    tokens = {};
  for (const who of ['operator', 'reviewer', 'other', 'viewer', 'admin', 'outsider'])
    tokens[who] = await sim.token({ sub: who });
  const request = async (
    path,
    {
      method = 'GET',
      body,
      who = 'operator',
      bearer = tokens[who],
      key,
      type = 'application/json',
    } = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': type,
        'X-Actor-Subject': 'reviewer',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(key === undefined ? {} : { 'Idempotency-Key': key }),
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: await response.json(),
      location: response.headers.get('location'),
    };
  };
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const conforms = (name, body) => {
    const v = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
    assert.equal(v(body), true, JSON.stringify(v.errors));
  };
  const input = { run_id: f.run.id, title: 'Investigate token=private-title' };
  let main;
  await t.test(
    'create201 Location, detail/page schemas and same-key retry return durable server-derived new state',
    async () => {
      const response = await request('/cases', { method: 'POST', body: input, key: 'create-once' });
      assert.equal(response.status, 201);
      conforms('Case', response.body);
      main = response.body;
      assert.equal(main.state, 'new');
      assert.equal(main.creator_subject, 'operator');
      assert.equal(main.owner_id, null);
      assert.equal(response.location, `/api/v1/workspaces/${workspace}/cases/${main.id}`);
      assert.doesNotMatch(main.title, /private-title/);
      assert.deepEqual(
        (await request('/cases', { method: 'POST', body: input, key: 'create-once' })).body,
        main,
      );
      assert.equal(
        (
          await request('/cases', {
            method: 'POST',
            body: { ...input, title: 'changed' },
            key: 'create-once',
          })
        ).status,
        409,
      );
      const detail = await request(`/cases/${main.id}`, { who: 'viewer' });
      assert.equal(detail.status, 200);
      conforms('CaseDetail', detail.body);
      assert.equal(detail.body.history.length, 1);
      const page = await request('/cases?state=new');
      conforms('CasesPage', page.body);
      assert.equal(page.body.items.length, 1);
      await sim.waitForRequest();
    },
  );
  await t.test(
    'assignees require caller write scope and active full-source candidates, including group grants',
    async () => {
      const path = `/cases/${main.id}/assignees`;
      let response = await request(path);
      assert.equal(response.status, 200);
      conforms('CaseAssignees', response.body);
      assert.deepEqual(
        response.body.items.map((m) => m.subject),
        ['operator', 'other', 'reviewer'],
      );
      assert.equal((await request(path, { bearer: '' })).status, 401);
      for (const who of ['viewer', 'admin'])
        assert.equal((await request(path, { who })).status, 403);
      assert.equal((await request(path, { who: 'outsider' })).status, 404);
      assert.equal((await request(path + '?limit=1')).status, 400);
      assert.equal((await request(`/cases/${randomUUID()}/assignees`)).status, 404);
      await pool.query(
        "UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='other' AND source_id=$1",
        [f.sources[2]],
      );
      assert.deepEqual(
        (await request(path)).body.items.map((m) => m.subject),
        ['operator', 'reviewer'],
      );
      const group = randomUUID();
      await pool.query("INSERT INTO core.groups(id,workspace_id,name) VALUES($1,$2,'Assignees')", [
        group,
        workspace,
      ]);
      await pool.query(
        "INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES($1,$2,'other')",
        [workspace, group],
      );
      await pool.query(
        "INSERT INTO core.source_grants(id,workspace_id,source_id,group_id,permission,granted_by) VALUES($1,$2,$3,$4,'read','test')",
        [randomUUID(), workspace, f.sources[2], group],
      );
      assert.deepEqual(
        (await request(path)).body.items.map((m) => m.subject),
        ['operator', 'other', 'reviewer'],
      );
      await pool.query(
        "UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND subject='other'",
        [workspace],
      );
      assert.deepEqual(
        (await request(path)).body.items.map((m) => m.subject),
        ['operator', 'reviewer'],
      );
      await pool.query(
        "UPDATE core.memberships SET revoked_at=NULL WHERE workspace_id=$1 AND subject='other'",
        [workspace],
      );
      await pool.query(
        "UPDATE core.source_grants SET revoked_at=NULL WHERE workspace_id=$1 AND grantee_subject='other'",
        [workspace],
      );
      await pool.query(
        "UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1",
        [f.sources[2]],
      );
      assert.equal((await request(path)).status, 404);
      await pool.query(
        "UPDATE core.source_grants SET revoked_at=NULL WHERE workspace_id=$1 AND grantee_subject='operator'",
        [workspace],
      );
    },
  );
  await t.test(
    'live case list filters state/owner and binds signed cursor to caller, filters, limit and current scope',
    async () => {
      for (let i = 0; i < 3; i++)
        assert.equal(
          (await request('/cases', { method: 'POST', body: { ...input, title: `Case ${i}` } }))
            .status,
          201,
        );
      const first = await request('/cases?limit=1');
      conforms('CasesPage', first.body);
      const cursor = encodeURIComponent(first.body.next_cursor);
      assert.ok(cursor);
      const next = await request(`/cases?limit=1&cursor=${cursor}`);
      assert.equal(next.status, 200);
      assert.notEqual(next.body.items[0].id, first.body.items[0].id);
      assert.equal((await request(`/cases?limit=2&cursor=${cursor}`)).status, 400);
      assert.equal((await request(`/cases?limit=1&state=closed&cursor=${cursor}`)).status, 400);
      assert.equal(
        (await request(`/cases?limit=1&cursor=${cursor}`, { who: 'viewer' })).status,
        400,
      );
      assert.equal((await request(`/cases?limit=1&cursor=${cursor}x`)).status, 400);
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`,
        [f.sources[2]],
      );
      assert.equal((await request(`/cases?limit=1&cursor=${cursor}`)).status, 400);
      assert.deepEqual((await request('/cases')).body.items, []);
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`,
      );
    },
  );
  await t.test(
    'workflow HTTP enforces owner/reviewer/evidence, freezes closed graph, reopens and preserves history on replay',
    async () => {
      let current = main;
      const transition = async (action, who = 'operator', extra = {}, key) => {
        const response = await request(`/cases/${main.id}/transitions`, {
          method: 'POST',
          who,
          key,
          body: {
            action,
            expected_version: current.version,
            reason: `checked ${action}`,
            ...extra,
          },
        });
        if (response.status === 200) {
          conforms('Case', response.body);
          current = response.body;
        }
        return response;
      };
      assert.equal((await transition('assign', 'operator', { owner_id: 'viewer' })).status, 422);
      const assignInput = {
        action: 'assign',
        expected_version: 1,
        reason: 'checked assign',
        owner_id: 'operator',
      };
      const assigned = await transition(
        'assign',
        'operator',
        { owner_id: 'operator' },
        'assign-once',
      );
      assert.equal(assigned.status, 200);
      assert.equal((await transition('start', 'other')).status, 403);
      assert.equal((await transition('start')).status, 200);
      assert.equal((await transition('request_verification')).status, 422);
      const evidence = await request(`/cases/${main.id}/evidence`, {
        method: 'POST',
        body: { kind: 'events', event_ids: [f.events[0]], note: 'Observed password=private-note' },
      });
      assert.equal(evidence.status, 201);
      conforms('Evidence', evidence.body);
      assert.doesNotMatch(evidence.body.note, /private-note/);
      assert.equal((await transition('request_verification')).status, 200);
      assert.equal((await transition('verification_failed', 'reviewer')).status, 200);
      assert.equal((await transition('request_verification')).status, 200);
      assert.equal((await transition('verify_close')).status, 403);
      assert.equal((await transition('verify_close', 'reviewer')).status, 422);
      const graph = (await request(`/runs/${f.run.id}/graph`)).body,
        link = graph.links[0];
      const reviewPath = `/runs/${f.run.id}/links/${link.id}/reviews`;
      assert.equal(
        (
          await request(reviewPath, {
            method: 'POST',
            who: 'reviewer',
            body: { decision: 'accepted', reason: 'checked', expected_version: 1 },
          })
        ).status,
        201,
      );
      assert.equal((await transition('verify_close', 'reviewer')).status, 200);
      assert.equal(current.state, 'closed');
      assert.equal(
        (
          await request(reviewPath, {
            method: 'POST',
            who: 'reviewer',
            body: { decision: 'rejected', reason: 'changed', expected_version: 2 },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(`/runs/${f.run.id}/links`, {
            method: 'POST',
            body: { from_event_id: f.events[0], to_event_id: f.events[2], reason: 'new' },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(`/cases/${main.id}/evidence`, {
            method: 'POST',
            body: { kind: 'note', event_ids: [], note: 'new' },
          })
        ).status,
        409,
      );
      assert.equal(
        (await transition('reopen', 'reviewer', { reason: 'New observation' })).status,
        200,
      );
      const retry = await request(`/cases/${main.id}/transitions`, {
        method: 'POST',
        body: assignInput,
        key: 'assign-once',
      });
      assert.deepEqual(retry.body, assigned.body);
      const detail = (await request(`/cases/${main.id}`, { who: 'viewer' })).body;
      conforms('CaseDetail', detail);
      assert.equal(detail.case.state, 'investigating');
      assert.equal(detail.history.at(-1).action, 'reopen');
      assert.doesNotMatch(JSON.stringify(detail), /evidence_snapshot|private-note|private-title/);
      assert.equal(
        (await request('/cases?state=investigating&owner_id=operator')).body.items.length,
        1,
      );
      assert.deepEqual(
        (await request('/cases', { method: 'POST', body: input, key: 'create-once' })).body,
        main,
      );
    },
  );
  await t.test(
    'JWT roles and closed body/query/media/ID bounds reject invalid input before writes',
    async () => {
      for (const bearer of [
        null,
        'bad',
        await sim.token({ sub: 'operator', azp: 'traceweaver-ingest' }),
      ]) {
        assert.equal(
          (await request('/cases', { method: 'POST', body: input, bearer })).status,
          401,
        );
      }
      for (const who of ['viewer', 'admin'])
        assert.equal((await request('/cases', { method: 'POST', body: input, who })).status, 403);
      assert.equal((await request('/cases', { who: 'outsider' })).status, 404);
      const cases = [
        ['/cases?state=new&state=closed', {}, 400],
        ['/cases?owner_id=', {}, 400],
        ['/cases?state=bad', {}, 400],
        ['/cases?unknown=x', {}, 400],
        ['/cases/bad', {}, 400],
        [`/cases/${randomUUID()}`, {}, 404],
        ['/cases', { method: 'POST', body: input, type: 'text/plain' }, 415],
        ['/cases', { method: 'POST', body: '{' }, 400],
        ['/cases', { method: 'POST', body: { ...input, state: 'closed' } }, 422],
        ['/cases', { method: 'POST', body: { ...input, title: 'x'.repeat(1048576) } }, 413],
        ['/cases', { method: 'POST', body: input, key: 'bad key' }, 400],
        [
          `/cases/${main.id}/evidence`,
          { method: 'POST', body: { kind: 'events', event_ids: [randomUUID()], note: '' } },
          404,
        ],
        [
          `/cases/${main.id}/transitions`,
          { method: 'POST', body: { action: 'start', reason: 'stale', expected_version: 1 } },
          409,
        ],
      ];
      for (const [path, options, status] of cases) {
        const response = await request(path, options);
        assert.equal(response.status, status, JSON.stringify(response.body));
        conforms('Error', response.body);
      }
    },
  );
  await t.test(
    'audit failures return sanitized503 and rollback create/evidence/transition/idempotency together',
    async () => {
      const fresh = (await request('/cases', { method: 'POST', body: input })).body;
      const before = (await request(`/cases/${fresh.id}`)).body;
      await pool.query(
        `CREATE FUNCTION core.fail_case_http_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-case-db-error'; END; $$`,
      );
      await pool.query(
        `CREATE TRIGGER fail_case_http_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action LIKE 'case.%') EXECUTE FUNCTION core.fail_case_http_audit()`,
      );
      for (const [path, body] of [
        ['/cases', input],
        [`/cases/${fresh.id}/evidence`, { kind: 'note', event_ids: [], note: 'verified' }],
        [
          `/cases/${fresh.id}/transitions`,
          { action: 'assign', expected_version: 1, owner_id: 'operator', reason: 'assign' },
        ],
      ]) {
        const response = await request(path, { method: 'POST', body, key: 'rollback-http' });
        assert.equal(response.status, 503);
        assert.doesNotMatch(JSON.stringify(response.body), /private-case-db-error/);
      }
      assert.deepEqual((await request(`/cases/${fresh.id}`)).body, before);
      await pool.query('DROP TRIGGER fail_case_http_audit ON core.audit_events');
      assert.equal(
        (await request('/cases', { method: 'POST', body: input, key: 'rollback-http' })).status,
        201,
      );
    },
  );
  await t.test(
    'revoked source/membership/role deny existing detail, evidence and cached create/transition responses',
    async () => {
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`,
        [f.sources[2]],
      );
      assert.equal((await request(`/cases/${main.id}`)).status, 404);
      assert.equal(
        (await request('/cases', { method: 'POST', body: input, key: 'create-once' })).status,
        404,
      );
      const assignment = {
        action: 'assign',
        expected_version: 1,
        reason: 'checked assign',
        owner_id: 'operator',
      };
      assert.equal(
        (
          await request(`/cases/${main.id}/transitions`, {
            method: 'POST',
            body: assignment,
            key: 'assign-once',
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request(`/cases/${main.id}/evidence`, {
            method: 'POST',
            body: { kind: 'note', event_ids: [], note: 'revoked' },
          })
        ).status,
        404,
      );
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`,
      );
      await pool.query(`DELETE FROM core.membership_roles WHERE subject='operator'`);
      assert.equal(
        (await request('/cases', { method: 'POST', body: input, key: 'create-once' })).status,
        403,
      );
      assert.equal(
        (
          await request(`/cases/${main.id}/transitions`, {
            method: 'POST',
            body: assignment,
            key: 'assign-once',
          })
        ).status,
        403,
      );
      await pool.query(
        `UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='viewer'`,
      );
      assert.equal((await request(`/cases/${main.id}`, { who: 'viewer' })).status, 404);
    },
  );
});
