// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { workflowInput } from '../../src/validations/workflow.validation.js';
import { createWorkflowService } from '../../src/services/workflow.service.js';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const create = {
  definition_key: 'document_review',
  definition_version: 1,
  entity_ref: { type: 'document', id },
  workspace_id: id,
  creator_subject: 'operator',
};
test('core workflow validation binds creator/workspace, normalizes IDs and rejects untrusted fields', () => {
  assert.deepEqual(workflowInput('WorkflowCreate', create, 'operator', id), create);
  for (const body of [
    { ...create, creator_subject: 'reviewer' },
    { ...create, workspace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { ...create, roles: ['reviewer'] },
    { ...create, definition: {} },
  ]) {
    assert.throws(() => workflowInput('WorkflowCreate', body, 'operator', id), { status: 422 });
  }
  const transition = {
    action: 'submit',
    expected_version: 1,
    reason: 'token=private',
    evidence_refs: [],
  };
  assert.equal(
    workflowInput('WorkflowTransition', transition, 'operator', id).reason,
    'token=[REDACTED]',
  );
  for (const body of [
    { ...transition, reason: ' ' },
    { ...transition, reason: '\u0000' },
    { ...transition, evidence_refs: [id, id.toUpperCase()] },
    { ...transition, facts: { evidence_count: 1 } },
  ]) {
    assert.throws(() => workflowInput('WorkflowTransition', body, 'operator', id), { status: 422 });
  }
});
test('core workflow service validates before writes and sanitizes failures', async () => {
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('private-database-error');
  };
  const service = createWorkflowService({ create: fail, get: fail, transition: fail });
  await assert.rejects(
    service.create('app', 'operator', id, { ...create, creator_subject: 'spoof' }),
    { status: 422 },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    service.create('app', 'operator', id, create),
    (e) => e.status === 503 && !e.message.includes('private'),
  );
});
