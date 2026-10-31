// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { readConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import { createDatabase } from '../../src/core/data/database.js';
import { loadMigrations, migrate } from '../../src/core/data/migrations.js';
import { createRunRepository } from '../../src/core/data/run-repository.js';
import { createRunService } from '../../src/services/run.service.js';
import { createReviewRepository } from '../../src/core/data/review-repository.js';
import { createReviewService } from '../../src/services/review.service.js';
import { createTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { identitySimulation } from '../support/oidc-simulation.js';
import { pythonScorer } from '../support/python-scorer.js';
import { createScorer } from '../../src/core/reconstruction/scorer.js';

test('run APIs: real JWT/Postman JWKS, PostgreSQL snapshots, schemas and permissions', async (t) => {
  const config = readConfig(),
    admin = createDatabase(config);
  t.after(() => admin.end());
  const name = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  console.log(`Run HTTP integration database retained: ${name}`);
  const url = new URL(config.databaseUrl);
  url.pathname = `/${name}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href });
  t.after(() => pool.end());
  await migrate(
    pool,
    await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url)),
  );
  const workspace = randomUUID(),
    sources = [randomUUID(), randomUUID(), randomUUID()];
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES($1,$2)', [workspace, 'Run HTTP']);
  for (const [subject, role] of [
    ['alice', 'operator'],
    ['viewer', 'viewer'],
    ['admin', 'admin'],
    ['writer', 'ingest_service'],
  ]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [
      workspace,
      subject,
    ]);
    await pool.query(
      'INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES($1,$2,$3)',
      [workspace, subject, role],
    );
    for (const [index, source] of sources.entries()) {
      const service = ['intake', 'account', 'provision'][index];
      await pool.query(
        `INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version)
        VALUES($1,$2,$3,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [source, workspace, `service${index}`, service, `${service}-v1`],
      );
      await pool.query(
        `INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by)
        VALUES($1,$2,$3,$4,$5,'test')`,
        [randomUUID(), workspace, source, subject, subject === 'writer' ? 'ingest' : 'read'],
      );
    }
  }
  const ingestion = createIngestionService(createIngestionRepository(pool));
  const records = [];
  for (const [index, source] of sources.entries())
    records.push(
      await ingestion.batch('writer', workspace, source, {
        events: [
          {
            source_event_id: `http-${index}`,
            occurred_at: `2026-10-22T00:00:0${index}Z`,
            service: ['intake', 'account', 'provision'][index],
            action: ['request.accepted', 'account.created', 'provision.completed'][index],
            outcome: 'success',
            identifiers: [{ namespace: 'request', value: 'R1' }],
            message: 'token=do-not-leak',
            payload: { password: 'do-not-leak' },
          },
        ],
      }),
    );
  const sim = await identitySimulation(t),
    verifyToken = createTokenVerifier(sim.config);
  const runs = createRunService(createRunRepository(pool));
  const reviews = createReviewService(createReviewRepository(pool));
  const server = createApp({
    checkReadiness: async () => true,
    access: {},
    verifyToken,
    runs,
    reviews,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}/runs`;
  const token = await sim.token(),
    viewer = await sim.token({ sub: 'viewer' });
  const request = async (
    path,
    { method = 'GET', body, bearer = token, key, type = 'application/json' } = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        'X-Actor-Subject': 'admin',
        'Content-Type': type,
        ...(key === undefined ? {} : { 'Idempotency-Key': key }),
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return {
      status: response.status,
      location: response.headers.get('location'),
      body: await response.json(),
      challenge: response.headers.get('www-authenticate'),
    };
  };
  const input = {
    root_event_id: records[0].results[0].event_id,
    source_ids: sources,
    window: { from: '2026-10-22T00:00:00Z', to: '2026-10-22T00:01:00Z' },
    mode: 'rule_only',
  };
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const conforms = (name, value) => {
    const validate = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
  };
  let run;
  await t.test(
    'POST202 Location, poll and graph conform; idempotent retry returns exact persisted result',
    async () => {
      const response = await request('', { method: 'POST', body: input, key: 'http-once' });
      assert.equal(response.status, 202);
      conforms('Run', response.body);
      run = response.body;
      assert.equal(response.location, `/api/v1/workspaces/${workspace}/runs/${run.id}`);
      assert.deepEqual((await request(`/${run.id}`)).body, run);
      const graph = await request(`/${run.id}/graph`, { bearer: viewer });
      assert.equal(graph.status, 200);
      conforms('Graph', graph.body);
      assert.equal(graph.body.nodes.length, 3);
      assert.equal(graph.body.links.length, 2);
      assert.doesNotMatch(
        JSON.stringify(graph.body),
        /do-not-leak|insert_xid|policy|creator_subject/,
      );
      assert.deepEqual(
        (
          await request('', {
            method: 'POST',
            body: { ...input, source_ids: [...sources].reverse() },
            key: 'http-once',
          })
        ).body,
        run,
      );
      assert.equal(
        (
          await request('', {
            method: 'POST',
            body: { ...input, mode: 'hybrid' },
            key: 'http-once',
          })
        ).status,
        409,
      );
      const degraded = await request('', { method: 'POST', body: { ...input, mode: 'hybrid' } });
      conforms('Run', degraded.body);
      assert.equal(degraded.body.degraded, true);
      assert.equal(degraded.body.mode, 'hybrid');
      await sim.waitForRequest();
    },
  );
  for (const model of [false, true])
    await t.test(
      `real Python ${model ? 'trained model v2' : 'baseline'}: JWT HTTP run, durable scores/audit/replay, review and scorer-down fallback`,
      { skip: !process.env.SCORER_PYTHON },
      async (t) => {
        const python = await pythonScorer(t, { model });
        const expectedModel = model
          ? 'logistic-regression-sandbox-features-2-experiment-1'
          : 'baseline-rule-v1';
        const scoredRuns = createRunService(
          createRunRepository(pool, undefined, createScorer(python)),
        );
        const api = createApp({
          checkReadiness: async () => true,
          access: {},
          verifyToken,
          runs: scoredRuns,
          reviews,
        }).listen(0, '127.0.0.1');
        await once(api, 'listening');
        t.after(() => {
          api.closeAllConnections();
          api.close();
        });
        const origin = `http://127.0.0.1:${api.address().port}/api/v1/workspaces/${workspace}/runs`;
        const call = async (path, body, key) => {
          const response = await fetch(origin + path, {
            method: body ? 'POST' : 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              ...(key ? { 'Idempotency-Key': key } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          return { status: response.status, body: await response.json() };
        };
        const hybrid = { ...input, mode: 'hybrid' };
        const replayKey = model ? 'python-e2e-model' : 'python-e2e-baseline';
        const created = await call('', hybrid, replayKey);
        assert.equal(created.status, 202);
        conforms('Run', created.body);
        assert.equal(created.body.model_version, expectedModel);
        assert.equal(created.body.degraded_reason, model ? null : 'ai_baseline_only');
        assert.equal(created.body.degraded, !model);
        assert.equal(created.body.effective_method, model ? 'hybrid' : 'rule_only');
        assert.equal(created.body.rule_version, 'sandbox-rules-2');
        const scoredGraph = (await call(`/${created.body.id}/graph`)).body;
        conforms('Graph', scoredGraph);
        assert.equal(scoredGraph.links.length, 2);
        assert.ok(
          scoredGraph.links.every(
            (link) =>
              link.method === 'rule' &&
              Number.isFinite(link.score) &&
              link.review_state === 'pending',
          ),
        );
        assert.deepEqual((await call('', hybrid, replayKey)).body, created.body);
        if (model) {
          const oldBaseline = await call('', hybrid, 'python-e2e-baseline');
          assert.equal(oldBaseline.body.model_version, 'baseline-rule-v1');
          assert.equal(oldBaseline.body.effective_method, 'rule_only');
        }
        const {
          rows: [audit],
        } = await pool.query('SELECT after_ref FROM core.audit_events WHERE entity_id=$1', [
          created.body.id,
        ]);
        assert.equal(audit.after_ref.model_version, expectedModel);
        assert.equal(audit.after_ref.feature_version, 'sandbox-observable-features-2');
        assert.equal(audit.after_ref.effective_method, model ? 'hybrid' : 'rule_only');
        assert.equal(audit.after_ref.degraded, !model);
        const link = scoredGraph.links[0];
        const review = await call(`/${created.body.id}/links/${link.id}/reviews`, {
          decision: 'accepted',
          reason: 'Observed direct edge',
          expected_version: 1,
        });
        assert.equal(review.status, 201);
        conforms('Review', review.body);
        const reviewed = (await call(`/${created.body.id}/graph`)).body;
        assert.equal(reviewed.links.find((item) => item.id === link.id).review_state, 'accepted');
        await python.stop();
        const fallback = await call('', hybrid);
        assert.equal(fallback.status, 202);
        conforms('Run', fallback.body);
        assert.equal(fallback.body.degraded_reason, 'ai_unavailable');
        assert.equal(fallback.body.model_version, null);
        const fallbackGraph = (await call(`/${fallback.body.id}/graph`)).body;
        assert.ok(
          fallbackGraph.links.every((item) => item.score === null && item.method === 'rule'),
        );
        assert.deepEqual((await call(`/${created.body.id}`)).body, created.body);
      },
    );
  await t.test(
    'JWT clients/subjects and DB roles are enforced; actor headers do not authorize',
    async () => {
      for (const bearer of [null, 'bad', await sim.token({ azp: 'traceweaver-ingest' })]) {
        const denied = await request('', { method: 'POST', body: input, bearer });
        assert.equal(denied.status, 401);
        assert.match(denied.challenge, /^Bearer/);
      }
      for (const bearer of [viewer, await sim.token({ sub: 'admin' })])
        assert.equal((await request('', { method: 'POST', body: input, bearer })).status, 403);
      assert.equal(
        (
          await request('', {
            method: 'POST',
            body: input,
            bearer: await sim.token({ sub: 'outsider' }),
          })
        ).status,
        404,
      );
      assert.equal((await request(`/${randomUUID()}`)).status, 404);
      assert.equal(
        (await request('', { method: 'POST', body: { ...input, root_event_id: randomUUID() } }))
          .status,
        404,
      );
    },
  );
  await t.test(
    'closed query/body, IDs, media type, size and idempotency limits fail before writes',
    async () => {
      const cases = [
        ['?actor=admin', { method: 'POST', body: input }, 400],
        ['/' + run.id + '?q=anything', {}, 400],
        ['/bad/graph', {}, 400],
        ['', { method: 'POST', body: { ...input, actor: 'admin' } }, 422],
        ['', { method: 'POST', body: input, key: 'bad key' }, 400],
        ['', { method: 'POST', body: input, type: 'text/plain' }, 415],
        ['', { method: 'POST', body: '{' }, 400],
        ['', { method: 'POST', body: { ...input, huge: 'x'.repeat(1048576) } }, 413],
        [
          '',
          {
            method: 'POST',
            body: { ...input, window: { from: input.window.from, to: '2026-10-22T02:00:00Z' } },
          },
          422,
        ],
      ];
      const before = (await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs'))
        .rows[0].n;
      for (const [path, options, status] of cases) {
        const response = await request(path, options);
        assert.equal(response.status, status, JSON.stringify(response.body));
        conforms('Error', response.body);
      }
      assert.equal(
        (await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs')).rows[0].n,
        before,
      );
    },
  );
  await t.test(
    'audit error returns sanitized503 without partial data; retry succeeds after recovery',
    async () => {
      await pool.query(
        `CREATE FUNCTION core.fail_http_run_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'hidden-db-password'; END; $$`,
      );
      await pool.query(
        `CREATE TRIGGER fail_http_run_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action='reconstruction.created') EXECUTE FUNCTION core.fail_http_run_audit()`,
      );
      const failed = await request('', { method: 'POST', body: input, key: 'recover' });
      assert.equal(failed.status, 503);
      assert.doesNotMatch(JSON.stringify(failed.body), /hidden-db-password/);
      await pool.query('DROP TRIGGER fail_http_run_audit ON core.audit_events');
      assert.equal(
        (await request('', { method: 'POST', body: input, key: 'recover' })).status,
        202,
      );
    },
  );
  await t.test(
    'review and manual HTTP contracts return201, project history/version, preserve evidence and report stale/cycle/duplicate',
    async () => {
      const fresh = (await request('', { method: 'POST', body: input })).body;
      const graph = (await request(`/${fresh.id}/graph`)).body,
        link = graph.links[0];
      const path = `/${fresh.id}/links/${link.id}/reviews`;
      const decision = {
        decision: 'accepted',
        reason: 'token=private-review',
        expected_version: 1,
      };
      const response = await request(path, { method: 'POST', body: decision });
      assert.equal(response.status, 201);
      conforms('Review', response.body);
      assert.equal(response.body.actor_subject, 'alice');
      assert.equal(response.body.link_version, 2);
      assert.equal(response.body.reason, 'token=[REDACTED]');
      assert.equal((await request(path, { method: 'POST', body: decision })).status, 409);
      const manualPath = `/${fresh.id}/links`,
        a = input.root_event_id,
        c = records[2].results[0].event_id;
      const manual = {
        from_event_id: a,
        to_event_id: c,
        reason: 'Observed shortcut password=private-manual',
      };
      const created = await request(manualPath, { method: 'POST', body: manual });
      assert.equal(created.status, 201);
      conforms('Link', created.body);
      assert.equal(created.body.review_state, 'pending');
      assert.equal(created.body.method, 'manual');
      assert.equal(created.body.score, null);
      assert.doesNotMatch(JSON.stringify(created.body), /private-manual/);
      assert.equal((await request(manualPath, { method: 'POST', body: manual })).status, 409);
      const cycle = await request(manualPath, {
        method: 'POST',
        body: { ...manual, from_event_id: c, to_event_id: a },
      });
      assert.equal(cycle.status, 422);
      assert.equal(cycle.body.error.code, 'LINK_CYCLE');
      const updated = (await request(`/${fresh.id}/graph`, { bearer: viewer })).body;
      conforms('Graph', updated);
      assert.equal(updated.version, 3);
      assert.equal(updated.links.length, graph.links.length + 1);
      const reviewed = updated.links.find((entry) => entry.id === link.id);
      assert.equal(reviewed.version, 2);
      assert.equal(reviewed.review_state, 'accepted');
      assert.deepEqual(reviewed.evidence, link.evidence);
    },
  );
  await t.test(
    'link routes enforce JWT, DB roles, closed inputs/IDs/media/size and sanitized audit rollback',
    async () => {
      const graph = (await request(`/${run.id}/graph`)).body,
        link = graph.links[0];
      const path = `/${run.id}/links/${link.id}/reviews`,
        manualPath = `/${run.id}/links`;
      const body = { decision: 'rejected', reason: 'observed', expected_version: 1 };
      for (const bearer of [null, 'bad', await sim.token({ azp: 'traceweaver-ingest' })]) {
        assert.equal((await request(path, { method: 'POST', body, bearer })).status, 401);
      }
      for (const bearer of [viewer, await sim.token({ sub: 'admin' })]) {
        assert.equal((await request(path, { method: 'POST', body, bearer })).status, 403);
        assert.equal(
          (
            await request(manualPath, {
              method: 'POST',
              body: {
                from_event_id: input.root_event_id,
                to_event_id: records[2].results[0].event_id,
                reason: 'forbidden',
              },
              bearer,
            })
          ).status,
          403,
        );
      }
      for (const [route, options, status] of [
        [path + '?actor=admin', { body }, 400],
        [`/${run.id}/links/bad/reviews`, { body }, 400],
        [path, { body, type: 'text/plain' }, 415],
        [path, { body: '{' }, 400],
        [path, { body: { ...body, reason: ' ' } }, 422],
        [path, { body: { ...body, reason: '\u0000' } }, 422],
        [path, { body: { ...body, actor_subject: 'admin' } }, 422],
        [path, { body: { ...body, expected_version: 0 } }, 422],
        [path, { body: { ...body, reason: 'x'.repeat(1048576) } }, 413],
        [`/${run.id}/links/${randomUUID()}/reviews`, { body }, 404],
        [
          manualPath,
          {
            body: {
              from_event_id: input.root_event_id,
              to_event_id: input.root_event_id,
              reason: 'self',
            },
          },
          422,
        ],
        [
          manualPath,
          {
            body: {
              from_event_id: input.root_event_id,
              to_event_id: randomUUID(),
              reason: 'unknown',
            },
          },
          404,
        ],
      ]) {
        const response = await request(route, { method: 'POST', ...options });
        assert.equal(response.status, status, JSON.stringify(response.body));
        conforms('Error', response.body);
      }
      await pool.query(
        `CREATE FUNCTION core.fail_http_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-link-audit-password'; END; $$`,
      );
      await pool.query(
        `CREATE TRIGGER fail_http_link_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action='link.reviewed') EXECUTE FUNCTION core.fail_http_link_audit()`,
      );
      const failed = await request(path, { method: 'POST', body });
      assert.equal(failed.status, 503);
      assert.doesNotMatch(JSON.stringify(failed.body), /private-link-audit-password/);
      assert.deepEqual((await request(`/${run.id}/graph`)).body, graph);
      await pool.query('DROP TRIGGER fail_http_link_audit ON core.audit_events');
      assert.equal((await request(path, { method: 'POST', body })).status, 201);
    },
  );
  await t.test(
    'source, role and membership revocation block cached responses and whole graphs immediately',
    async () => {
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='alice' AND source_id=$1`,
        [sources[2]],
      );
      for (const path of [`/${run.id}`, `/${run.id}/graph`])
        assert.equal((await request(path)).status, 404);
      assert.equal(
        (await request('', { method: 'POST', body: input, key: 'http-once' })).status,
        404,
      );
      const graph = (await request(`/${run.id}/graph`, { bearer: viewer })).body;
      const reviewPath = `/${run.id}/links/${graph.links[0].id}/reviews`;
      const decision = { decision: 'accepted', reason: 'revoked', expected_version: 2 };
      assert.equal((await request(reviewPath, { method: 'POST', body: decision })).status, 404);
      await pool.query(
        `UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='alice'`,
      );
      await pool.query(
        `DELETE FROM core.membership_roles WHERE subject='alice' AND role_key='operator'`,
      );
      assert.equal(
        (await request('', { method: 'POST', body: input, key: 'http-once' })).status,
        403,
      );
      assert.equal((await request(reviewPath, { method: 'POST', body: decision })).status, 403);
      await pool.query(
        `UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='viewer'`,
      );
      assert.equal((await request(`/${run.id}/graph`, { bearer: viewer })).status, 404);
    },
  );
});
