// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { runInput, idempotencyKey } from '../../src/validations/run.validation.js';
import { sandboxRulePolicy, missingSteps } from '../../src/core/reconstruction/policy.js';
import { createRuleEngine } from '../../src/core/reconstruction/rules.js';
import { createRunService } from '../../src/services/run.service.js';
import { ApiError } from '../../src/core/identity/api-error.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const body = {
  root_event_id: id,
  source_ids: [id],
  mode: 'rule_only',
  window: { from: '2026-10-22T00:00:00Z', to: '2026-10-22T01:00:00Z' },
};
test('run input reuses schemas and exact closed time bounds, normalizes UUIDs and rejects duplicate sources', () => {
  assert.deepEqual(runInput({ ...body, root_event_id: id.toUpperCase() }), body);
  for (const patch of [
    { mode: 'fake' },
    { actor: 'admin' },
    { source_ids: [] },
    { root_event_id: 'bad' },
    { source_ids: [id, id.toUpperCase()] },
  ])
    assert.throws(() => runInput({ ...body, ...patch }), { status: 422 });
  assert.throws(
    () => runInput({ ...body, window: { ...body.window, to: '2026-10-22T01:00:00.000001Z' } }),
    { status: 422, code: 'WINDOW_TOO_LARGE' },
  );
  assert.throws(
    () => runInput({ ...body, window: { from: body.window.to, to: body.window.from } }),
    { status: 400 },
  );
  assert.throws(
    () => runInput({ ...body, window: { ...body.window, from: '0000-01-01T00:00:00Z' } }),
    { status: 400 },
  );
});
test('idempotency key is optional and bounded; missing steps describe absent evidence, including failed terminal steps', () => {
  assert.equal(idempotencyKey(), null);
  assert.equal(idempotencyKey('retry-1'), 'retry-1');
  for (const value of ['', ' ', 'bad key', 'x'.repeat(201), ['a', 'b'], '\n'])
    assert.throws(() => idempotencyKey(value), { status: 400 });
  assert.doesNotThrow(() => createRuleEngine(sandboxRulePolicy()));
  assert.deepEqual(
    missingSteps([
      { service: 'intake', action: 'request.accepted' },
      { service: 'provision', action: 'provision.failed' },
    ]),
    [
      {
        step: 'account',
        process_template_version: 'sandbox-process-1',
        label: 'chưa có bằng chứng',
      },
    ],
  );
});
test('run service validates before repository calls and sanitizes infrastructure failures', async () => {
  let calls = 0;
  const service = createRunService({
    async create() {
      calls++;
      throw new Error('password=private-db-error');
    },
    async get() {
      throw new ApiError(409, 'RUN_NOT_READY', 'Run graph is not ready');
    },
  });
  await assert.rejects(service.create('u', id, { ...body, actor: 'admin' }), { status: 422 });
  await assert.rejects(service.create('u', id, body, ' '), { status: 400 });
  assert.equal(calls, 0);
  await assert.rejects(
    service.create('u', id, body),
    (error) => error.status === 503 && !error.message.includes('private'),
  );
  await assert.rejects(service.get('u', id, id, true), { status: 409, code: 'RUN_NOT_READY' });
});
