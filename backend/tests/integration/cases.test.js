// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { caseFixture } from '../support/case-fixture.js';
import { withTransaction } from '../../src/core/data/database.js';
import { createWorkflow } from '../../src/core/data/workflow-store.js';
import { documentReviewDefinition } from '../../src/core/workflow/definitions.js';

test('case workflow persistence, scope, closure lock and audit on PostgreSQL', async (t) => {
  const f = await caseFixture(t), { pool, workspace, cases, runs, reviews } = f;
  const make = (run = f.run.id, key) => cases.create('operator', workspace, { run_id: run, title: 'Investigate' }, key);
  const step = (id, action, version, subject = 'reviewer', extra = {}) => cases.transition(subject, workspace, id,
    { action, expected_version: version, reason: `Reason for ${action}`, ...extra });
  let main;
  await t.test('upgrade006 preserves run; case has no competing state/owner and retries serialize with scoped 24h replay', async () => {
    assert.equal((await runs.get('viewer', workspace, f.run.id, true)).nodes.length, 3);
    const race = await Promise.all(Array.from({ length: 3 }, () => make(f.run.id, 'case-once')));
    assert.ok(race.every((item) => item.id === race[0].id)); main = race[0];
    assert.equal(main.state, 'new'); assert.equal(main.owner_id, null); assert.equal(main.version, 1);
    assert.deepEqual(await make(f.run.id, 'case-once'), main);
    await assert.rejects(cases.create('operator', workspace, { run_id: f.run.id, title: 'Changed' }, 'case-once'), { status: 409 });
    const columns = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='cases'`)).rows.map((r) => r.column_name);
    assert.ok(!columns.includes('state') && !columns.includes('owner_id'));
    assert.equal((await cases.get('viewer', workspace, main.id)).history.length, 1);
    assert.equal((await pool.query(`SELECT count(*)::int n FROM core.audit_events WHERE action='case.created' AND entity_id=$1`, [main.id])).rows[0].n, 1);
  });
  await t.test('owner/role/version guards, evidence scope, full lifecycle, closure freeze and reopen', async () => {
    await assert.rejects(step(main.id, 'assign', 1, 'operator', { owner_id: 'viewer' }), { status: 422 });
    const assigned = await step(main.id, 'assign', 1, 'operator', { owner_id: 'operator' }); assert.equal(assigned.version, 2);
    await assert.rejects(step(main.id, 'start', 1, 'operator'), { status: 409 });
    await assert.rejects(step(main.id, 'start', 2, 'other'), { status: 403 });
    await step(main.id, 'start', 2, 'operator');
    await assert.rejects(step(main.id, 'request_verification', 3, 'operator'), { status: 422 });
    await assert.rejects(cases.evidence('operator', workspace, main.id, { kind: 'events', event_ids: [randomUUID()], note: 'outside snapshot' }), { status: 404 });
    const evidence = await cases.evidence('operator', workspace, main.id, { kind: 'events', event_ids: [f.events[0]], note: 'Observed request' });
    await step(main.id, 'request_verification', 3, 'operator');
    await assert.rejects(step(main.id, 'verify_close', 4, 'operator'), { status: 403 });
    await assert.rejects(step(main.id, 'verify_close', 4), { status: 422 });
    const link = (await runs.get('operator', workspace, f.run.id, true)).links[0];
    await reviews.review('reviewer', workspace, f.run.id, link.id, { decision: 'accepted', reason: 'checked', expected_version: 1 });
    const closed = await step(main.id, 'verify_close', 4); assert.equal(closed.state, 'closed');
    const detail = await cases.get('viewer', workspace, main.id);
    assert.equal(detail.history.length, 5); assert.deepEqual(detail.history.at(-1).evidence_refs, [evidence.id]);
    await assert.rejects(pool.query(`INSERT INTO core.case_evidence_events(workspace_id,case_id,evidence_id,run_id,event_id)
      VALUES($1,$2,$3,$4,$5)`, [workspace, randomUUID(), evidence.id, f.run.id, f.events[1]]), { code: '23503' });
    const spare = randomUUID();
    await withTransaction(pool, (client) => createWorkflow(client, { id: spare, workspace, creator: 'operator',
      entity: { type: 'document', id: randomUUID() }, definition: documentReviewDefinition }));
    assert.equal((await pool.query('SELECT to_state FROM core.workflow_history WHERE instance_id=$1', [spare])).rows[0].to_state, 'draft');
    await assert.rejects(pool.query(`INSERT INTO core.cases(id,workspace_id,run_id,workflow_instance_id,title,creator_subject)
      VALUES($1,$2,$3,$4,'Cross-workspace','operator')`, [randomUUID(), f.otherWorkspace, f.run.id, spare]), { code: '23503' });
    const snapshot = (await pool.query(`SELECT evidence_snapshot FROM core.workflow_history WHERE instance_id=$1 AND version=5`, [main.workflow_instance_id])).rows[0].evidence_snapshot;
    assert.deepEqual(snapshot.links, [{ id: link.id, version: 2, review_state: 'accepted' }]);
    await assert.rejects(reviews.review('reviewer', workspace, f.run.id, link.id, { decision: 'rejected', reason: 'change', expected_version: 2 }), { code: 'CASE_CLOSED' });
    await assert.rejects(reviews.manual('operator', workspace, f.run.id, { from_event_id: f.events[0], to_event_id: f.events[2], reason: 'new' }), { code: 'CASE_CLOSED' });
    await assert.rejects(cases.evidence('operator', workspace, main.id, { kind: 'note', event_ids: [], note: 'later' }), { code: 'CASE_CLOSED' });
    await assert.rejects(step(main.id, 'reopen', 5, 'reviewer', { reason: 'Reason for verify_close' }), { status: 422 });
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`, [f.sources[2]]);
    await assert.rejects(step(main.id, 'reopen', 5), { status: 422 });
    await pool.query(`UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`);
    assert.equal((await step(main.id, 'reopen', 5)).state, 'investigating');
    await reviews.review('reviewer', workspace, f.run.id, link.id, { decision: 'rejected', reason: 'after reopen', expected_version: 2 });
  });
  await t.test('concurrent transitions use one version, idempotency replays exact result, history is immutable', async () => {
    const fresh = await make();
    const request = { action: 'assign', expected_version: 1, reason: 'Assign', owner_id: 'operator' };
    const result = await Promise.allSettled(['operator', 'reviewer'].map((who) => cases.transition(who, workspace, fresh.id, request)));
    assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(result.find((r) => r.status === 'rejected').reason.status, 409);
    const start = { action: 'start', expected_version: 2, reason: 'Start' };
    const committed = await cases.transition('operator', workspace, fresh.id, start, 'transition-once');
    assert.deepEqual(await cases.transition('operator', workspace, fresh.id, start, 'transition-once'), committed);
    await assert.rejects(cases.transition('operator', workspace, fresh.id, { ...start, reason: 'Changed' }, 'transition-once'), { status: 409 });
    for (const table of ['cases', 'workflow_instances', 'workflow_history', 'case_evidence', 'case_evidence_events']) {
      await assert.rejects(pool.query(`DELETE FROM core.${table}`), { code: '55000' });
    }
    const before = await make(f.run.id, 'expiry');
    await pool.query(`UPDATE core.case_idempotency SET expires_at=clock_timestamp()-interval '1 second' WHERE case_id=$1`, [before.id]);
    assert.notEqual((await make(f.run.id, 'expiry')).id, before.id);
  });
  await t.test('current empty-source revocation protects detail/list/writes/replays and removes hidden cases before pagination', async () => {
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='operator' AND source_id=$1`, [f.sources[2]]);
    await assert.rejects(cases.get('operator', workspace, main.id), { status: 404 });
    await assert.rejects(make(f.run.id, 'case-once'), { status: 404 });
    assert.deepEqual(await cases.list('operator', workspace, null, 10, '', ''), []);
    await pool.query(`UPDATE core.source_grants SET revoked_at=NULL WHERE grantee_subject='operator'`);
    for (const subject of ['viewer', 'admin', 'writer']) await assert.rejects(cases.create(subject, workspace, { run_id: f.run.id, title: 'No' }), { status: 403 });
    await assert.rejects(cases.get('operator', f.otherWorkspace, main.id), { status: 404 });
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='viewer'`);
    await assert.rejects(cases.get('viewer', workspace, main.id), { status: 404 });
    await pool.query(`UPDATE core.memberships SET revoked_at=NULL WHERE subject='viewer'`);
  });
  await t.test('closure and new manual edge race cannot both commit or silently change closed evidence', async () => {
    const run = await runs.create('operator', workspace, f.input), fresh = await make(run.id);
    await step(fresh.id, 'assign', 1, 'operator', { owner_id: 'operator' }); await step(fresh.id, 'start', 2);
    await cases.evidence('operator', workspace, fresh.id, { kind: 'note', event_ids: [], note: 'Verified observations' });
    await step(fresh.id, 'request_verification', 3);
    const link = (await runs.get('operator', workspace, run.id, true)).links[0];
    await reviews.review('reviewer', workspace, run.id, link.id, { decision: 'accepted', reason: 'checked', expected_version: 1 });
    const race = await Promise.allSettled([step(fresh.id, 'verify_close', 4), reviews.manual('operator', workspace, run.id,
      { from_event_id: f.events[0], to_event_id: f.events[2], reason: 'new proposal' })]);
    assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok([409, 422].includes(race.find((r) => r.status === 'rejected').reason.status));
  });
  await t.test('audit failure atomically rolls back case creation, transition, evidence and idempotency', async () => {
    const fresh = await make();
    const count = async () => (await pool.query(`SELECT (SELECT count(*) FROM core.cases)::int cases,
      (SELECT count(*) FROM core.workflow_instances)::int instances,(SELECT count(*) FROM core.workflow_history)::int history,
      (SELECT count(*) FROM core.case_evidence)::int evidence,(SELECT count(*) FROM core.case_idempotency)::int keys`)).rows[0];
    const before = await count();
    await pool.query(`CREATE FUNCTION core.fail_case_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-case-error'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_case_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action LIKE 'case.%') EXECUTE FUNCTION core.fail_case_audit()`);
    await assert.rejects(make(f.run.id, 'rollback'));
    await assert.rejects(cases.evidence('operator', workspace, fresh.id, { kind: 'note', event_ids: [], note: 'rollback' }));
    await assert.rejects(cases.transition('operator', workspace, fresh.id, { action: 'assign', owner_id: 'operator', expected_version: 1, reason: 'rollback' }, 'rollback'));
    assert.deepEqual(await count(), before);
    await pool.query('DROP TRIGGER fail_case_audit ON core.audit_events');
    assert.equal((await make(f.run.id, 'rollback')).state, 'new');
  });
});
