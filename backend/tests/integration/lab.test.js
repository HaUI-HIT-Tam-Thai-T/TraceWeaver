// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { caseFixture } from '../support/case-fixture.js';
import { createLabRepository } from '../../src/core/data/lab-repository.js';
import { createLabCollector } from '../../src/core/data/lab-collector.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';

test('persistent sandbox enforces permissions, retries and concurrent capacity allocation', async t => {
  const fixture = await caseFixture(t);
  const { pool, workspace, sources } = fixture;
  const lab = createLabRepository(pool);
  await assert.rejects(lab.configure('operator', workspace, sources), e => e.status === 403);
  let state = await lab.configure('admin', workspace, sources);
  await assert.rejects(lab.command('viewer', workspace, { action: 'submit' }), e => e.status === 403);
  state = await lab.command('operator', workspace, { action: 'submit', request_id: 'lab-1', ram: 4, expected_version: state.version });
  state = await lab.command('operator', workspace, { action: 'provision', request_id: 'lab-1', operation_id: 'attempt-1', expected_version: state.version });
  assert.equal((await lab.inspect('reviewer', workspace, 'lab-1')).result, 'failed');
  state = await lab.command('admin', workspace, { action: 'capacity', ram: 4, expected_version: state.version });
  state = await lab.command('operator', workspace, { action: 'submit', request_id: 'lab-2', ram: 4, expected_version: state.version });
  const results = await Promise.allSettled(['lab-1', 'lab-2'].map(request_id => lab.command('operator', workspace,
    { action: 'provision', request_id, operation_id: `provision-${request_id}`, expected_version: state.version })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const restored = await createLabRepository(pool).read('reviewer', workspace);
  assert.equal(restored.requests.filter(r => r.environment).length, 1);
  const ingestion = createIngestionService(createIngestionRepository(pool));
  const collect = createLabCollector(pool, ingestion, 'writer');
  const delivery = await collect();
  assert.ok(delivery.delivered > 0);
  assert.equal(delivery.examined, delivery.delivered);
  assert.equal((await collect()).examined, 0);
  const before = (await pool.query('SELECT count(*)::int AS n FROM core.events')).rows[0].n;
  await pool.query('UPDATE core.lab_outbox SET delivered_at=NULL');
  assert.equal((await collect()).delivered, delivery.delivered);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM core.events')).rows[0].n, before);
  await pool.query("UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND grantee_subject='reviewer'", [workspace]);
  await assert.rejects(lab.inspect('reviewer', workspace, 'lab-1'), e => e.status === 404);
});

test('reviewer closes only after source repair and fresh server-owned verification', async t => {
  const { pool, workspace, sources, run, cases, reviews, runs } = await caseFixture(t);
  const lab = createLabRepository(pool);
  let state = await lab.configure('admin', workspace, sources);
  state = await lab.command('operator', workspace, { action: 'submit', request_id: 'R1', ram: 4, expected_version: state.version });
  state = await lab.command('operator', workspace, { action: 'provision', request_id: 'R1', operation_id: 'failed', expected_version: state.version });
  const item = await cases.create('operator', workspace, { run_id: run.id, title: 'Repair RAM' });
  const step = (action, version, extra = {}) => cases.transition('reviewer', workspace, item.id,
    { action, expected_version: version, reason: 'Verified source behavior', ...extra });
  await step('assign', 1, { owner_id: 'operator' });
  await step('start', 2);
  await cases.evidence('operator', workspace, item.id, { kind: 'note', event_ids: [], note: 'Investigated capacity' });
  for (const link of (await runs.get('reviewer', workspace, run.id, true)).links)
    await reviews.review('reviewer', workspace, run.id, link.id, { decision: 'accepted', reason: 'Checked identifiers', expected_version: link.version });
  await step('request_verification', 3);
  await assert.rejects(cases.verify('operator', workspace, item.id), e => e.status === 403);
  assert.equal((await cases.verify('reviewer', workspace, item.id)).observation.result, 'failed');
  await assert.rejects(step('verify_close', 4), e => e.code === 'VERIFICATION_REQUIRED');
  state = await lab.command('admin', workspace, { action: 'capacity', ram: 8, expected_version: state.version });
  state = await lab.command('operator', workspace, { action: 'provision', request_id: 'R1', operation_id: 'repaired', expected_version: state.version });
  await assert.rejects(step('verify_close', 4), e => e.code === 'VERIFICATION_REQUIRED');
  const proof = await cases.verify('reviewer', workspace, item.id);
  assert.equal(proof.observation.result, 'passed');
  state = await lab.command('admin', workspace, { action: 'capacity', ram: 9, expected_version: state.version });
  await assert.rejects(step('verify_close', 4), e => e.code === 'VERIFICATION_REQUIRED');
  await cases.verify('reviewer', workspace, item.id);
  assert.equal((await step('verify_close', 4)).state, 'closed');
  await step('reopen', 5, { reason: 'New symptom after closure' });
  await step('request_verification', 6);
  await assert.rejects(step('verify_close', 7), e => e.code === 'VERIFICATION_REQUIRED');
  await assert.rejects(pool.query('DELETE FROM core.case_verifications'), e => e.code === '55000');
});
