// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { caseFixture } from '../support/case-fixture.js';
import { createWorkflowRepository } from '../../src/core/data/workflow-repository.js';
import { createDatabase } from '../../src/core/data/database.js';
import { createWorkflowRepository as createGenericWorkflowRepository } from '../../src/core/workflow/repository.js';
test('core repository persists documents, delegates cases and rolls back audit failures', async (t) => {
  const f = await caseFixture(t), { pool, workspace } = f, repo = createWorkflowRepository(pool), app = 'core-app';
  await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [workspace, app]);
  const create = (id = randomUUID()) => ({ definition_key: 'document_review', definition_version: 1,
    entity_ref: { type: 'document', id }, workspace_id: workspace, creator_subject: 'operator' });
  const step = (id, action, version, who = 'operator', extra = {}) => repo.transition(app, who, workspace, id,
    { action, expected_version: version, reason: `Checked ${action}`, evidence_refs: [], ...extra });
  await t.test('custom admin workflow uses registered creation and transition roles on PostgreSQL', async () => {
    const definition = { key: 'admin_approval', version: 1, initial: 'draft', states: ['draft', 'approved'],
      transitions: { approve: { from: ['draft'], to: 'approved', roles: ['admin'], guards: [] } } };
    const generic = createGenericWorkflowRepository(pool, { definitions: [{ definition, entityType: 'approval' }] });
    const input = { ...create(), definition_key: definition.key, creator_subject: 'admin', entity_ref: { type: 'approval', id: randomUUID() } };
    for (const subject of ['viewer', 'operator', 'reviewer']) {
      await assert.rejects(generic.create(app, subject, workspace, input), { status: 403 });
    }
    const instance = await generic.create(app, 'admin', workspace, input);
    assert.equal(instance.state, 'draft');
    const command = { action: 'approve', expected_version: 1, reason: 'Approved by admin', evidence_refs: [] };
    await assert.rejects(generic.transition(app, 'reviewer', workspace, instance.id, command), { status: 403 });
    const approved = await generic.transition(app, 'admin', workspace, instance.id, command);
    assert.equal(approved.state, 'approved'); assert.equal(approved.version, 2);
    assert.equal(approved.history.at(-1).actor_subject, 'admin');
    await assert.rejects(repo.create(app, 'admin', workspace, { ...create(), creator_subject: 'admin' }), { status: 403 });
  });
  await t.test('document entity uniqueness, expected version concurrency, role guard and history', async () => {
    const input = create(), doc = await repo.create(app, 'operator', workspace, input);
    assert.equal(doc.state, 'draft'); assert.equal(doc.history[0].actor_subject, 'operator');
    await assert.rejects(repo.create(app, 'operator', workspace, input), { status: 409 });
    const raceInput = create();
    const reordered = { ...raceInput, entity_ref: { id: raceInput.entity_ref.id, type: 'document' } };
    const creations = await Promise.allSettled([repo.create(app, 'operator', workspace, raceInput), repo.create(app, 'operator', workspace, reordered)]);
    assert.equal(creations.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(creations.find((r) => r.status === 'rejected').reason.status, 409);
    const concurrent = await Promise.allSettled([step(doc.id, 'submit', 1), step(doc.id, 'submit', 1)]);
    assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(concurrent.find((r) => r.status === 'rejected').reason.status, 409);
    await assert.rejects(step(doc.id, 'approve', 2), { status: 403 });
    const approved = await step(doc.id, 'approve', 2, 'reviewer'); assert.equal(approved.state, 'approved');
    assert.equal(approved.history.length, 3); assert.equal(approved.history.at(-1).actor_subject, 'reviewer');
    await assert.rejects(repo.get(app, 'operator', f.otherWorkspace, doc.id), { status: 404 });
  });
  await t.test('existing case lookup uses the transaction connection even with a one-connection pool', async () => {
    const c = await f.cases.create('operator', workspace, { run_id: f.run.id, title: 'Pool scope' });
    const { rows: [db] } = await pool.query('SELECT current_database() AS name');
    const url = new URL(f.config.databaseUrl); url.pathname = `/${db.name}`;
    const single = createDatabase({ ...f.config, databaseUrl: url.href, poolMax: 1 });
    try {
      const constrained = createWorkflowRepository(single);
      await assert.rejects(constrained.create(app, 'operator', workspace,
        { ...create(), definition_key: 'case_handling', entity_ref: { type: 'case', id: c.id } }),
      { status: 409, code: 'WORKFLOW_EXISTS' });
    } finally { await single.end(); }
  });
  await t.test('case core transitions share authoritative state, evidence guards and run freeze', async () => {
    const c = await f.cases.create('operator', workspace, { run_id: f.run.id, title: 'Core test' });
    const id = c.workflow_instance_id;
    await assert.rejects(repo.create(app, 'operator', workspace, { ...create(), definition_key: 'case_handling', entity_ref: { type: 'case', id: c.id } }), { status: 409 });
    assert.equal((await repo.get(app, 'viewer', workspace, id)).state, 'new');
    await step(id, 'assign', 1, 'operator', { owner_subject: 'operator' }); await step(id, 'start', 2);
    await assert.rejects(step(id, 'request_verification', 3), { status: 422 });
    await assert.rejects(step(id, 'request_verification', 3, 'operator', { evidence_refs: [randomUUID()] }), { status: 404 });
    const e = await f.cases.evidence('operator', workspace, c.id, { kind: 'note', event_ids: [], note: 'Observed' });
    await step(id, 'request_verification', 3, 'operator', { evidence_refs: [e.id] });
    await assert.rejects(step(id, 'verify_close', 4, 'reviewer'), { status: 422 });
    const link = (await f.runs.get('reviewer', workspace, f.run.id, true)).links[0];
    await f.reviews.review('reviewer', workspace, f.run.id, link.id, { decision: 'accepted', reason: 'Checked', expected_version: 1 });
    const closed = await step(id, 'verify_close', 4, 'reviewer'); assert.equal(closed.state, 'closed');
    assert.equal((await f.cases.get('viewer', workspace, c.id)).case.state, 'closed');
    await assert.rejects(f.reviews.review('reviewer', workspace, f.run.id, link.id, { decision: 'rejected', reason: 'Later', expected_version: 2 }), { status: 409 });
    await step(id, 'reopen', 5, 'reviewer');
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`, [f.sources[2]]);
    await assert.rejects(repo.get(app, 'operator', workspace, id), { status: 404 });
    await assert.rejects(step(id, 'request_verification', 6), { status: 404 });
    await pool.query(`UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`);
  });
  await t.test('audit failure rolls back generic create and history with sanitized service errors handled above repository', async () => {
    const doc = await repo.create(app, 'operator', workspace, create());
    await pool.query(`CREATE FUNCTION core.fail_workflow_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-workflow-error'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_workflow_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action LIKE 'workflow.%') EXECUTE FUNCTION core.fail_workflow_audit()`);
    const input = create();
    await assert.rejects(repo.create(app, 'operator', workspace, input)); await assert.rejects(step(doc.id, 'submit', 1));
    assert.equal((await repo.get(app, 'viewer', workspace, doc.id)).history.length, 1);
    assert.equal((await pool.query('SELECT 1 FROM core.workflow_instances WHERE entity_id=$1', [input.entity_ref.id])).rowCount, 0);
    await pool.query('DROP TRIGGER fail_workflow_audit ON core.audit_events');
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject=$1`, [app]);
    await assert.rejects(repo.get(app, 'viewer', workspace, doc.id), { status: 404 });
    await assert.rejects(step(doc.id, 'submit', 1), { status: 404 });
    await assert.rejects(repo.create(app, 'operator', workspace, create()), { status: 404 });
  });
});
