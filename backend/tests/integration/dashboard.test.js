// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { caseFixture } from '../support/case-fixture.js';
import { createDashboardRepository } from '../../src/core/data/dashboard-repository.js';

test('dashboard counters share current full scope, live graph and workflow state', async (t) => {
  const f = await caseFixture(t), { pool, workspace, sources } = f;
  const repository = createDashboardRepository(pool), get = (who = 'viewer', filters = {}) => repository.get(who, workspace, filters);
  const first = await f.cases.create('operator', workspace, { run_id: f.run.id, title: 'First' });
  const second = await f.cases.create('operator', workspace, { run_id: f.run.id, title: 'Second' });
  const expected = { runs: 1, degraded_runs: 0, unresolved_events: 1, waiting_cases: 2, filters: {} };
  assert.deepEqual(await get(), expected);
  const transition = (id, action, expected_version, extra = {}) => f.cases.transition('operator', workspace, id,
    { action, expected_version, reason: 'Checked', ...extra });
  await transition(first.id, 'assign', 1, { owner_id: 'operator' });
  assert.equal((await get()).waiting_cases, 2);
  await transition(first.id, 'start', 2);
  assert.equal((await get()).waiting_cases, 1);
  const graph = await f.runs.get('viewer', workspace, f.run.id, true);
  await f.reviews.review('reviewer', workspace, f.run.id, graph.links[0].id,
    { decision: 'rejected', reason: 'Not connected', expected_version: 1 });
  assert.equal((await get()).unresolved_events, (await f.runs.get('viewer', workspace, f.run.id, true)).unresolved_event_ids.length);
  const hybrid = await f.runs.create('operator', workspace, { ...f.input, mode: 'hybrid' });
  const totals = await get(); assert.equal(totals.runs, 2); assert.equal(totals.degraded_runs, 1);
  assert.equal(totals.unresolved_events, 3); // per-run occurrences, never distinct across snapshots
  const filters = { from: hybrid.created_at, to: hybrid.created_at };
  const filtered = await get('viewer', filters); assert.deepEqual(filtered.filters, filters);
  assert.deepEqual(filtered, { runs: 1, degraded_runs: 1, unresolved_events: 1, waiting_cases: 0, filters });
  const list = (range) => f.cases.list('viewer', workspace, null, 100, '', '', range);
  assert.equal((await list(filters)).length, 0);
  assert.equal((await list({ from: f.run.created_at, to: f.run.created_at })).length, 2);
  const time = f.run.created_at.slice(0, -1), before = { to: time + '0001Z' }, after = { from: time + '0001Z' };
  assert.equal((await get('viewer', before)).runs, 1);
  assert.equal((await get('viewer', after)).runs, 1);
  assert.equal((await list(before)).length, 2);
  assert.equal((await list(after)).length, 0);
  assert.equal((await get('viewer', { from: '2099-01-01T00:00:00Z' })).runs, 0);
  const manual = await f.reviews.manual('operator', workspace, f.run.id,
    { from_event_id: f.events[0], to_event_id: f.events[2], reason: 'Observed relationship' });
  assert.equal((await get()).unresolved_events, 2);
  await f.reviews.review('reviewer', workspace, f.run.id, manual.id,
    { decision: 'rejected', reason: 'Insufficient evidence', expected_version: 1 });
  assert.deepEqual(await get(), totals);
  await assert.rejects(get('outsider'), { status: 404 });
  await assert.rejects(get('writer'), { status: 403 });
  await pool.query(`UPDATE core.source_grants SET revoked_at=now() WHERE grantee_subject IN ('viewer','admin') AND source_id=$1`, [sources[2]]);
  const zero = { runs: 0, degraded_runs: 0, unresolved_events: 0, waiting_cases: 0, filters: {} };
  assert.deepEqual(await get(), zero); assert.deepEqual(await get('admin'), zero);
  const group = randomUUID();
  await pool.query(`INSERT INTO core.groups(id,workspace_id,name) VALUES($1,$2,'Dashboard readers')`, [group, workspace]);
  await pool.query(`INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES($1,$2,'viewer')`, [workspace, group]);
  await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,group_id,permission,granted_by)
    VALUES($1,$2,$3,$4,'read','test')`, [randomUUID(), workspace, sources[2], group]);
  assert.deepEqual(await get(), totals);
  await pool.query(`DELETE FROM core.group_members WHERE workspace_id=$1 AND group_id=$2`, [workspace, group]);
  assert.deepEqual(await get(), zero);
  await pool.query(`UPDATE core.memberships SET revoked_at=now() WHERE workspace_id=$1 AND subject='operator'`, [workspace]);
  await assert.rejects(get('operator'), { status: 404 });
  await pool.query(`DELETE FROM core.membership_roles WHERE workspace_id=$1 AND subject='viewer'`, [workspace]);
  await assert.rejects(get(), { status: 403 });
  assert.ok(second.id);
});
