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
import { createAppTokenVerifier, createTokenVerifier, createIngestTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createWorkflowRepository } from '../../src/core/data/workflow-repository.js';
import { createWorkflowService } from '../../src/services/workflow.service.js';
test('core HTTP requires app plus verified user and enforces both definitions on PostgreSQL', async (t) => {
  const f = await caseFixture(t), { pool, workspace } = f, sim = await identitySimulation(t), app = 'core-service';
  await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [workspace, app]);
  const config = { ...sim.config, oidcAppClientId: 'traceweaver-core', oidcAppSubject: app, oidcIngestClientId: 'traceweaver-ingest' };
  const verifyAppToken = createAppTokenVerifier(config), verifyToken = createTokenVerifier(config);
  const appToken = await sim.token({ sub: app, azp: config.oidcAppClientId });
  const users = {};
  for (const who of ['operator', 'reviewer', 'viewer', 'admin', 'outsider']) users[who] = await sim.token({ sub: who, roles: ['reviewer'] });
  const server = createApp({ checkReadiness: async () => true, verifyToken, verifyAppToken,
    workflows: createWorkflowService(createWorkflowRepository(pool)) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/core/v1/instances`;
  const request = async (path = '', { method = 'GET', body, who = 'operator', service = appToken, user = users[who], wid = workspace, headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': wid,
      'X-Actor-Subject': 'reviewer', ...(service ? { Authorization: `Bearer ${service}` } : {}),
      ...(user ? { 'X-End-User-Authorization': `Bearer ${user}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), location: response.headers.get('location') };
  };
  const create = () => ({ definition_key: 'document_review', definition_version: 1, entity_ref: { type: 'document', id: randomUUID() }, workspace_id: workspace, creator_subject: 'operator' });
  const transition = (action, expected_version, extra = {}) => ({ action, expected_version, reason: 'Checked token=private-reason', evidence_refs: [], ...extra });
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const conforms = (body) => { const validate = ajv.getSchema(`${schema.$id}#/$defs/WorkflowInstance`); assert.equal(validate(body), true, JSON.stringify(validate.errors)); };
  let doc;
  await t.test('independent service/user verification rejects missing, spoofed, expired and cross-client credentials', async () => {
    const badServices = [null, 'bad', users.operator, await sim.token({ sub: app, azp: 'traceweaver-ingest' }),
      await sim.token({ sub: 'wrong-service', azp: config.oidcAppClientId }), await sim.token({ sub: app, azp: config.oidcAppClientId, exp: 1 }),
      await sim.token({ sub: app, azp: config.oidcAppClientId, aud: 'wrong' })];
    for (const service of badServices) assert.equal((await request('', { method: 'POST', body: create(), service })).status, 401);
    for (const user of [null, 'bad', appToken, await sim.token({ sub: 'operator', azp: 'traceweaver-ingest' }), await sim.token({ sub: 'operator', exp: 1 })]) {
      assert.equal((await request('', { method: 'POST', body: create(), user })).status, 401);
    }
    await assert.rejects(verifyToken(appToken), { status: 401 });
    await assert.rejects(createIngestTokenVerifier(config)(appToken), { status: 401 });
    await assert.rejects(createAppTokenVerifier({ ...config, oidcAppSubject: '' })(appToken), { status: 503 });
    for (const who of ['viewer', 'admin']) assert.equal((await request('', { method: 'POST', who, body: { ...create(), creator_subject: who } })).status, 403);
    assert.equal((await request('', { method: 'POST', who: 'outsider', body: { ...create(), creator_subject: 'outsider' } })).status, 404);
    await sim.waitForRequest(); assert.match(sim.logs(), /certs/);
  });
  await t.test('document create/get/submit/approve use server roles and immutable history with both identities audited', async () => {
    const input = create(), result = await request('', { method: 'POST', body: input });
    assert.equal(result.status, 201, JSON.stringify(result.body)); doc = result.body; conforms(doc);
    assert.equal(result.location, `/core/v1/instances/${doc.id}`); assert.equal(doc.state, 'draft');
    assert.equal((await request('', { method: 'POST', body: input })).status, 409);
    assert.equal((await request(`/${doc.id}`, { who: 'viewer' })).status, 200);
    assert.equal((await request(`/${doc.id}/transitions`, { method: 'POST', body: transition('submit', 1) })).status, 200);
    assert.equal((await request(`/${doc.id}/transitions`, { method: 'POST', body: transition('submit', 1) })).status, 409);
    assert.equal((await request(`/${doc.id}/transitions`, { method: 'POST', body: transition('approve', 2) })).status, 403);
    const approved = await request(`/${doc.id}/transitions`, { method: 'POST', who: 'reviewer', body: transition('approve', 2) });
    assert.equal(approved.status, 200); conforms(approved.body); assert.equal(approved.body.state, 'approved');
    assert.equal(approved.body.history.at(-1).actor_subject, 'reviewer'); assert.doesNotMatch(JSON.stringify(approved.body), /private-reason|evidence_snapshot|definition":/);
    const audit = (await pool.query('SELECT actor_subject,after_ref FROM core.audit_events WHERE entity_id=$1 ORDER BY occurred_at DESC LIMIT 1', [doc.id])).rows[0];
    assert.equal(audit.actor_subject, 'reviewer'); assert.equal(audit.after_ref.app_subject, app);
  });
  await t.test('case instance HTTP shares state/guards and current full-source grants including empty sources', async () => {
    const c = await f.cases.create('operator', workspace, { run_id: f.run.id, title: 'Core HTTP' }), id = c.workflow_instance_id;
    const get = await request(`/${id}`); assert.equal(get.status, 200); conforms(get.body); assert.equal(get.body.definition_key, 'case_handling');
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('assign', 1, { owner_subject: 'operator' }) })).status, 200);
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('start', 2) })).status, 200);
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('request_verification', 3, { evidence_refs: [randomUUID()] }) })).status, 404);
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('request_verification', 3) })).status, 422);
    const e = await f.cases.evidence('operator', workspace, c.id, { kind: 'note', event_ids: [], note: 'Observed' });
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('request_verification', 3, { evidence_refs: [e.id] }) })).status, 200);
    assert.equal((await f.cases.get('viewer', workspace, c.id)).case.state, 'awaiting_verification');
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`, [f.sources[2]]);
    assert.equal((await request(`/${id}`)).status, 404);
    assert.equal((await request(`/${id}/transitions`, { method: 'POST', body: transition('verification_failed', 4) })).status, 404);
    await pool.query(`UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`);
  });
  await t.test('closed input/headers/media/definition and workspace bounds reject before writes', async () => {
    const input = create();
    for (const body of [{ ...input, creator_subject: 'reviewer' }, { ...input, workspace_id: f.otherWorkspace }, { ...input, facts: {} },
      { ...input, definition_version: 2 }, { ...input, definition_key: 'untrusted' }, { ...input, entity_ref: { type: 'case', id: randomUUID() } }]) {
      assert.equal((await request('', { method: 'POST', body })).status, 422);
    }
    const invalid = [
      ['', { method: 'POST', body: '{' }, 400], ['', { method: 'POST', body: input, headers: { 'Content-Type': 'text/plain' } }, 415],
      ['', { method: 'POST', body: { ...input, extra: 'x'.repeat(1048576) } }, 413],
      [`/${doc.id}?role=reviewer`, {}, 400], [`/${doc.id}`, { wid: 'bad' }, 400], [`/${doc.id}`, { wid: f.otherWorkspace }, 404],
      ['/bad', {}, 400], [`/${randomUUID()}`, {}, 404],
      ['', { method: 'POST', body: input, headers: { 'Idempotency-Key': 'unsupported' } }, 400],
      [`/${doc.id}/transitions`, { method: 'POST', body: transition('revise', 3, { evidence_refs: [randomUUID()] }) }, 422],
    ];
    for (const [path, options, status] of invalid) { const r = await request(path, options); assert.equal(r.status, status, JSON.stringify(r.body)); }
  });
  await t.test('audit failure returns sanitized503 and preserves history; current user/service membership and roles revoke old tokens', async () => {
    const fresh = (await request('', { method: 'POST', body: create() })).body;
    await pool.query(`CREATE FUNCTION core.fail_http_workflow_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-db-error'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_http_workflow_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action LIKE 'workflow.%') EXECUTE FUNCTION core.fail_http_workflow_audit()`);
    for (const [path, body] of [['', create()], [`/${fresh.id}/transitions`, transition('submit', 1)]]) {
      const response = await request(path, { method: 'POST', body }); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(response.body), /private-db-error/);
    }
    assert.equal((await request(`/${fresh.id}`)).body.history.length, 1);
    await pool.query('DROP TRIGGER fail_http_workflow_audit ON core.audit_events');
    await pool.query(`DELETE FROM core.membership_roles WHERE subject='operator'`);
    assert.equal((await request(`/${fresh.id}`)).status, 403);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='viewer'`);
    assert.equal((await request(`/${fresh.id}`, { who: 'viewer' })).status, 404);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject=$1`, [app]);
    assert.equal((await request(`/${fresh.id}`, { who: 'reviewer' })).status, 404);
    assert.equal((await request('', { method: 'POST', who: 'reviewer', body: { ...create(), creator_subject: 'reviewer' } })).status, 404);
    assert.equal((await request(`/${fresh.id}/transitions`, { method: 'POST', who: 'reviewer', body: transition('submit', 1) })).status, 404);
  });
});
