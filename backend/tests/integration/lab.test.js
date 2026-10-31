// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { caseFixture } from '../support/case-fixture.js';
import { createLabRepository } from '../../src/core/data/lab-repository.js';
import { createLabCollector } from '../../src/core/data/lab-collector.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createApp } from '../../src/app.js';
import { createCaseService } from '../../src/services/case.service.js';
import { once } from 'node:events';

test('three persisted conditions repair independently and retries retain old evidence', async (t) => {
  const { pool, workspace, sources, runs, cases } = await caseFixture(t);
  const lab = createLabRepository(pool);
  let state = await lab.configure('admin', workspace, sources);
  await assert.rejects(
    lab.command('operator', workspace, {
      action: 'submit',
      request_id: 'token=synthetic-audit-only',
      ram: 4,
      expected_version: state.version,
    }),
    (e) => e.status === 400 && e.code === 'INVALID_INPUT',
  );
  assert.deepEqual(await lab.read('operator', workspace), state);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM core.lab_outbox')).rows[0].n, 0);
  const send = async (subject, command) => {
    state = await lab.command(subject, workspace, { expected_version: state.version, ...command });
  };
  await send('operator', {
    action: 'submit',
    request_id: 'multi',
    ram: 4,
    image_available: false,
    account_active: false,
  });
  const run = (operation_id) =>
    send('operator', { action: 'provision', request_id: 'multi', operation_id });
  await run('all-fail');
  assert.deepEqual(state.requests[0].attempts[0].blockers, [
    'INSUFFICIENT_RAM',
    'IMAGE_UNAVAILABLE',
    'ACCOUNT_DISABLED',
  ]);
  await send('admin', { action: 'capacity', ram: 8 });
  await run('ram-repaired');
  assert.equal(state.requests[0].attempts.at(-1).reason, 'IMAGE_UNAVAILABLE');
  const image = {
    action: 'image',
    request_id: 'multi',
    image_id: state.requests[0].image_id,
    available: true,
  };
  await assert.rejects(send('operator', image), (e) => e.status === 403);
  await assert.rejects(send('admin', { ...image, image_id: 'wrong' }), (e) => e.status === 422);
  await send('admin', image);
  await run('image-repaired');
  assert.equal(state.requests[0].attempts.at(-1).reason, 'ACCOUNT_DISABLED');
  await send('admin', {
    action: 'account',
    request_id: 'multi',
    account_id: state.requests[0].account_id,
    active: true,
  });
  assert.notEqual((await lab.inspect('reviewer', workspace, 'multi')).result, 'passed');
  await run('all-repaired');
  assert.equal((await lab.inspect('reviewer', workspace, 'multi')).result, 'passed');
  const before = (await pool.query('SELECT count(*)::int AS n FROM core.lab_outbox')).rows[0].n;
  await run('all-repaired');
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM core.lab_outbox')).rows[0].n,
    before,
  );
  assert.equal(
    (await createLabRepository(pool).read('reviewer', workspace)).requests[0].attempts.length,
    4,
  );
  const result = await createLabCollector(
    pool,
    createIngestionService(createIngestionRepository(pool)),
    'writer',
  )();
  assert.equal(result.delivered, result.examined);
  const request_id = 'Yêu-cầu-01';
  await send('operator', { action: 'submit', request_id, ram: 1 });
  await send('operator', { action: 'provision', request_id, operation_id: 'unicode-request' });
  const collect = createLabCollector(
    pool,
    createIngestionService(createIngestionRepository(pool)),
    'writer',
  );
  await collect();
  const root = (
    await pool.query(
      `SELECT event_id,document FROM core.events WHERE workspace_id=$1
    AND document->>'action'='request.accepted' AND document->'identifiers' @> $2::jsonb`,
      [workspace, JSON.stringify([{ namespace: 'request', value: request_id }])],
    )
  ).rows[0];
  assert.ok(root);
  const at = Date.parse(root.document.occurred_at);
  const unicodeRun = await runs.create('operator', workspace, {
    root_event_id: root.event_id,
    source_ids: sources,
    mode: 'rule_only',
    window: { from: new Date(at - 1000).toISOString(), to: new Date(at + 60000).toISOString() },
  });
  const item = await cases.create('operator', workspace, {
    run_id: unicodeRun.id,
    title: 'Unicode request binding regression',
  });
  const bound = await cases.sandbox('operator', workspace, item.id);
  assert.equal(bound.observation.request_id, request_id);
  assert.equal(bound.observation.result, 'passed');
});

test('persistent sandbox enforces permissions, retries and concurrent capacity allocation', async (t) => {
  const fixture = await caseFixture(t);
  const { pool, workspace, sources } = fixture;
  const lab = createLabRepository(pool);
  await assert.rejects(lab.configure('operator', workspace, sources), (e) => e.status === 403);
  let state = await lab.configure('admin', workspace, sources);
  await assert.rejects(
    lab.command('viewer', workspace, { action: 'submit' }),
    (e) => e.status === 403,
  );
  state = await lab.command('operator', workspace, {
    action: 'submit',
    request_id: 'lab-1',
    ram: 4,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'lab-1',
    operation_id: 'attempt-1',
    expected_version: state.version,
  });
  assert.equal((await lab.inspect('reviewer', workspace, 'lab-1')).result, 'failed');
  state = await lab.command('admin', workspace, {
    action: 'capacity',
    ram: 4,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'submit',
    request_id: 'lab-2',
    ram: 4,
    expected_version: state.version,
  });
  const results = await Promise.allSettled(
    ['lab-1', 'lab-2'].map((request_id) =>
      lab.command('operator', workspace, {
        action: 'provision',
        request_id,
        operation_id: `provision-${request_id}`,
        expected_version: state.version,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const restored = await createLabRepository(pool).read('reviewer', workspace);
  assert.equal(restored.requests.filter((r) => r.environment).length, 1);
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
  await pool.query(
    "UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND grantee_subject='reviewer'",
    [workspace],
  );
  await assert.rejects(lab.inspect('reviewer', workspace, 'lab-1'), (e) => e.status === 404);
});

test('reviewer closes only after source repair and fresh server-owned verification', async (t) => {
  const {
    pool,
    workspace,
    sources,
    run: unrelatedRun,
    cases,
    reviews,
    runs,
  } = await caseFixture(t);
  const lab = createLabRepository(pool);
  let state = await lab.configure('admin', workspace, sources);
  state = await lab.command('operator', workspace, {
    action: 'submit',
    request_id: 'R1',
    ram: 4,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'R1',
    operation_id: 'failed',
    expected_version: state.version,
  });
  const collect = createLabCollector(
    pool,
    createIngestionService(createIngestionRepository(pool)),
    'writer',
  );
  await collect();
  const root = (
    await pool.query(
      "SELECT e.event_id,e.document FROM core.events e WHERE e.document->>'action'='request.accepted' AND e.source_event_id IN (SELECT id::text FROM core.lab_outbox)",
    )
  ).rows[0];
  const at = Date.parse(root.document.occurred_at);
  const run = await runs.create('operator', workspace, {
    root_event_id: root.event_id,
    source_ids: sources,
    mode: 'rule_only',
    window: { from: new Date(at - 1000).toISOString(), to: new Date(at + 60000).toISOString() },
  });
  const unrelatedCase = await cases.create('operator', workspace, {
    run_id: unrelatedRun.id,
    title: 'Same request ID, unrelated source',
  });
  await assert.rejects(
    cases.sandbox('operator', workspace, unrelatedCase.id),
    (e) => e.code === 'SANDBOX_BINDING_REQUIRED',
  );
  const item = await cases.create('operator', workspace, { run_id: run.id, title: 'Repair RAM' });
  const server = createApp({
    verifyToken: async (token) => ({ subject: token }),
    access: {},
    cases: createCaseService(cases),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}/cases/${item.id}/sandbox`;
  assert.equal((await fetch(url, { headers: { authorization: 'Bearer viewer' } })).status, 200);
  const body = {
    action: 'provision',
    expected_case_version: 1,
    expected_version: state.version,
    operation_id: 'http-failure',
  };
  const post = (subject, value) =>
    fetch(`${url}/commands`, {
      method: 'POST',
      headers: { authorization: `Bearer ${subject}`, 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
  assert.equal((await post('operator', { ...body, request_id: 'another' })).status, 400);
  assert.equal((await post('viewer', body)).status, 403);
  const execution = await post('operator', body);
  assert.equal(execution.status, 200);
  assert.equal((await execution.json()).execution.replayed, false);
  const replay = await post('operator', body);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).execution.replayed, true);
  state = await lab.read('operator', workspace);
  assert.equal((await cases.sandbox('viewer', workspace, item.id)).observation.request_id, 'R1');
  await assert.rejects(
    cases.sandbox('viewer', workspace, item.id, {
      action: 'provision',
      expected_case_version: 1,
      expected_version: state.version,
      operation_id: 'denied',
    }),
    (e) => e.status === 403,
  );
  const step = (action, version, extra = {}) =>
    cases.transition('reviewer', workspace, item.id, {
      action,
      expected_version: version,
      reason: 'Verified source behavior',
      ...extra,
    });
  await step('assign', 1, { owner_id: 'operator' });
  await step('start', 2);
  await cases.evidence('operator', workspace, item.id, {
    kind: 'note',
    event_ids: [],
    note: 'Investigated capacity',
  });
  for (const link of (await runs.get('reviewer', workspace, run.id, true)).links)
    await reviews.review('reviewer', workspace, run.id, link.id, {
      decision: 'accepted',
      reason: 'Checked identifiers',
      expected_version: link.version,
    });
  await step('request_verification', 3);
  await assert.rejects(cases.verify('operator', workspace, item.id), (e) => e.status === 403);
  assert.equal((await cases.verify('reviewer', workspace, item.id)).observation.result, 'failed');
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED');
  state = await lab.command('admin', workspace, {
    action: 'capacity',
    ram: 8,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'R1',
    operation_id: 'repaired',
    expected_version: state.version,
  });
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED');
  const proof = await cases.verify('reviewer', workspace, item.id);
  assert.equal(proof.observation.result, 'passed');
  assert.equal(proof.observation.delivery.status, 'pending');
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED');
  state = await lab.command('admin', workspace, {
    action: 'capacity',
    ram: 9,
    expected_version: state.version,
  });
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED');
  const rerun = await cases.sandbox('operator', workspace, item.id, {
    action: 'provision',
    expected_case_version: 4,
    expected_version: state.version,
    operation_id: 'current',
  });
  state = await lab.read('operator', workspace);
  assert.equal(rerun.observation.result, 'passed');
  await collect();
  const beforeChanges = await cases.verify('reviewer', workspace, item.id);
  for (const active of [false, true])
    state = await lab.command('admin', workspace, {
      action: 'account',
      request_id: 'R1',
      account_id: state.requests[0].account_id,
      active,
      expected_version: state.version,
    });
  assert.equal(
    (await cases.sandbox('reviewer', workspace, item.id)).observation.reason,
    'RERUN_REQUIRED',
  );
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED');
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'R1',
    operation_id: 'after-condition-repair',
    expected_version: state.version,
  });
  await collect();
  await assert.rejects(step('verify_close', 4), (e) => e.code === 'VERIFICATION_REQUIRED'); // New attempt needs its own proof.
  const finalProof = await cases.verify('reviewer', workspace, item.id);
  state = await lab.command('operator', workspace, {
    action: 'submit',
    request_id: 'R2',
    ram: 2,
    image_available: false,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'R2',
    operation_id: 'unrelated-failed',
    expected_version: state.version,
  });
  state = await lab.command('admin', workspace, {
    action: 'image',
    request_id: 'R2',
    image_id: 'lab-image-R2',
    available: true,
    expected_version: state.version,
  });
  state = await lab.command('operator', workspace, {
    action: 'provision',
    request_id: 'R2',
    operation_id: 'unrelated-passed',
    expected_version: state.version,
  });
  const current = (await cases.sandbox('reviewer', workspace, item.id)).observation;
  assert.equal(current.result, 'passed');
  assert.notEqual(finalProof.observation.source_version, current.source_version);
  assert.equal(finalProof.observation.attempt.id, current.attempt.id);
  const proofs = await cases.verifications('reviewer', workspace, item.id);
  assert.deepEqual(
    proofs.items.find((p) => p.id === beforeChanges.id),
    beforeChanges,
  );
  assert.deepEqual(
    proofs.items.find((p) => p.id === finalProof.id),
    finalProof,
  );
  assert.equal((await step('verify_close', 4)).state, 'closed');
  assert.equal((await cases.sandbox('reviewer', workspace, item.id)).observation.result, 'passed');
  await assert.rejects(
    cases.sandbox('operator', workspace, item.id, {
      action: 'provision',
      expected_case_version: 5,
      expected_version: state.version,
      operation_id: 'closed',
    }),
    (e) => e.code === 'CASE_CLOSED',
  );
  await step('reopen', 5, { reason: 'New symptom after closure' });
  await step('request_verification', 6);
  await assert.rejects(step('verify_close', 7), (e) => e.code === 'VERIFICATION_REQUIRED');
  await assert.rejects(
    pool.query('DELETE FROM core.case_verifications'),
    (e) => e.code === '55000',
  );
});
