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
import { createTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { identitySimulation } from '../support/oidc-simulation.js';

test('run APIs: real JWT/Postman JWKS, PostgreSQL snapshots, schemas and permissions', async (t) => {
  const config = readConfig(), admin = createDatabase(config); t.after(() => admin.end());
  const name = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${name}"`); console.log(`Run HTTP integration database retained: ${name}`);
  const url = new URL(config.databaseUrl); url.pathname = `/${name}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href }); t.after(() => pool.end());
  await migrate(pool, await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url)));
  const workspace = randomUUID(), sources = [randomUUID(), randomUUID(), randomUUID()];
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES($1,$2)', [workspace, 'Run HTTP']);
  for (const [subject, role] of [['alice', 'operator'], ['viewer', 'viewer'], ['admin', 'admin'], ['writer', 'ingest_service']]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES($1,$2,$3)', [workspace, subject, role]);
    for (const [index, source] of sources.entries()) {
      const service = ['intake', 'account', 'provision'][index];
      await pool.query(`INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version)
        VALUES($1,$2,$3,$3,$4,$5) ON CONFLICT DO NOTHING`, [source, workspace, `service${index}`, service, `${service}-v1`]);
      await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by)
        VALUES($1,$2,$3,$4,$5,'test')`, [randomUUID(), workspace, source, subject, subject === 'writer' ? 'ingest' : 'read']);
    }
  }
  const ingestion = createIngestionService(createIngestionRepository(pool));
  const records = [];
  for (const [index, source] of sources.entries()) records.push(await ingestion.batch('writer', workspace, source, { events: [{
    source_event_id: `http-${index}`, occurred_at: `2026-10-22T00:00:0${index}Z`, service: ['intake', 'account', 'provision'][index],
    action: ['request.accepted', 'account.created', 'provision.completed'][index], outcome: 'success',
    identifiers: [{ namespace: 'request', value: 'R1' }], message: 'token=do-not-leak', payload: { password: 'do-not-leak' },
  }] }));
  const sim = await identitySimulation(t), verifyToken = createTokenVerifier(sim.config);
  const runs = createRunService(createRunRepository(pool));
  const server = createApp({ checkReadiness: async () => true, access: {}, verifyToken, runs }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}/runs`;
  const token = await sim.token(), viewer = await sim.token({ sub: 'viewer' });
  const request = async (path, { method = 'GET', body, bearer = token, key, type = 'application/json' } = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      'X-Actor-Subject': 'admin', 'Content-Type': type, ...(key === undefined ? {} : { 'Idempotency-Key': key }) },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    return { status: response.status, location: response.headers.get('location'), body: await response.json(), challenge: response.headers.get('www-authenticate') };
  };
  const input = { root_event_id: records[0].results[0].event_id, source_ids: sources,
    window: { from: '2026-10-22T00:00:00Z', to: '2026-10-22T00:01:00Z' }, mode: 'rule_only' };
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const conforms = (name, value) => { const validate = ajv.getSchema(`${schema.$id}#/$defs/${name}`); assert.equal(validate(value), true, JSON.stringify(validate.errors)); };
  let run;
  await t.test('POST202 Location, poll and graph conform; idempotent retry returns exact persisted result', async () => {
    const response = await request('', { method: 'POST', body: input, key: 'http-once' });
    assert.equal(response.status, 202); conforms('Run', response.body); run = response.body;
    assert.equal(response.location, `/api/v1/workspaces/${workspace}/runs/${run.id}`);
    assert.deepEqual((await request(`/${run.id}`)).body, run);
    const graph = await request(`/${run.id}/graph`, { bearer: viewer });
    assert.equal(graph.status, 200); conforms('Graph', graph.body);
    assert.equal(graph.body.nodes.length, 3); assert.equal(graph.body.links.length, 2);
    assert.doesNotMatch(JSON.stringify(graph.body), /do-not-leak|insert_xid|policy|creator_subject/);
    assert.deepEqual((await request('', { method: 'POST', body: { ...input, source_ids: [...sources].reverse() }, key: 'http-once' })).body, run);
    assert.equal((await request('', { method: 'POST', body: { ...input, mode: 'hybrid' }, key: 'http-once' })).status, 409);
    const degraded = await request('', { method: 'POST', body: { ...input, mode: 'hybrid' } });
    conforms('Run', degraded.body); assert.equal(degraded.body.degraded, true); assert.equal(degraded.body.mode, 'hybrid');
    await sim.waitForRequest();
  });
  await t.test('JWT clients/subjects and DB roles are enforced; actor headers do not authorize', async () => {
    for (const bearer of [null, 'bad', await sim.token({ azp: 'traceweaver-ingest' })]) {
      const denied = await request('', { method: 'POST', body: input, bearer });
      assert.equal(denied.status, 401); assert.match(denied.challenge, /^Bearer/);
    }
    for (const bearer of [viewer, await sim.token({ sub: 'admin' })]) assert.equal((await request('', { method: 'POST', body: input, bearer })).status, 403);
    assert.equal((await request('', { method: 'POST', body: input, bearer: await sim.token({ sub: 'outsider' }) })).status, 404);
    assert.equal((await request(`/${randomUUID()}`)).status, 404);
    assert.equal((await request('', { method: 'POST', body: { ...input, root_event_id: randomUUID() } })).status, 404);
  });
  await t.test('closed query/body, IDs, media type, size and idempotency limits fail before writes', async () => {
    const cases = [
      ['?actor=admin', { method: 'POST', body: input }, 400], ['/' + run.id + '?q=anything', {}, 400],
      ['/bad/graph', {}, 400], ['', { method: 'POST', body: { ...input, actor: 'admin' } }, 422],
      ['', { method: 'POST', body: input, key: 'bad key' }, 400], ['', { method: 'POST', body: input, type: 'text/plain' }, 415],
      ['', { method: 'POST', body: '{' }, 400], ['', { method: 'POST', body: { ...input, huge: 'x'.repeat(1048576) } }, 413],
      ['', { method: 'POST', body: { ...input, window: { from: input.window.from, to: '2026-10-22T02:00:00Z' } } }, 422],
    ];
    const before = (await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs')).rows[0].n;
    for (const [path, options, status] of cases) {
      const response = await request(path, options); assert.equal(response.status, status, JSON.stringify(response.body)); conforms('Error', response.body);
    }
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs')).rows[0].n, before);
  });
  await t.test('audit error returns sanitized503 without partial data; retry succeeds after recovery', async () => {
    await pool.query(`CREATE FUNCTION core.fail_http_run_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'hidden-db-password'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_http_run_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action='reconstruction.created') EXECUTE FUNCTION core.fail_http_run_audit()`);
    const failed = await request('', { method: 'POST', body: input, key: 'recover' });
    assert.equal(failed.status, 503); assert.doesNotMatch(JSON.stringify(failed.body), /hidden-db-password/);
    await pool.query('DROP TRIGGER fail_http_run_audit ON core.audit_events');
    assert.equal((await request('', { method: 'POST', body: input, key: 'recover' })).status, 202);
  });
  await t.test('source, role and membership revocation block cached responses and whole graphs immediately', async () => {
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='alice' AND source_id=$1`, [sources[2]]);
    for (const path of [`/${run.id}`, `/${run.id}/graph`]) assert.equal((await request(path)).status, 404);
    assert.equal((await request('', { method: 'POST', body: input, key: 'http-once' })).status, 404);
    await pool.query(`UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='alice'`);
    await pool.query(`DELETE FROM core.membership_roles WHERE subject='alice' AND role_key='operator'`);
    assert.equal((await request('', { method: 'POST', body: input, key: 'http-once' })).status, 403);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='viewer'`);
    assert.equal((await request(`/${run.id}/graph`, { bearer: viewer })).status, 404);
  });
});
