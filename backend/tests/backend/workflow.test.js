// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkflowEngine } from '../../src/core/workflow/engine.js';
import { caseDefinition, documentReviewDefinition } from '../../src/core/workflow/definitions.js';

const engine = createWorkflowEngine(caseDefinition);
const facts = { valid_owner: true, has_note: true, evidence_count: 1, pending_links: 0, new_reason: true };
const command = (action, expected_version = 1) => ({ action, expected_version, reason: 'verified', owner_subject: 'owner' });
test('case workflow enforces state/version, role and owner through explicit server facts', () => {
  const actor = { subject: 'owner', roles: ['operator'] };
  const start = { state: 'new', owner_subject: null, version: 1 };
  assert.deepEqual(engine.transition(start, command('assign'), actor, facts), { state: 'assigned', owner_subject: 'owner', version: 2 });
  assert.throws(() => engine.transition(start, command('assign', 2), actor, facts), { status: 409 });
  assert.throws(() => engine.transition(start, command('verify_close'), actor, facts), { status: 403 });
  assert.throws(() => engine.transition(start, command('start'), { subject: 'reviewer', roles: ['reviewer'] }, facts), { status: 422 });
  assert.throws(() => engine.transition(start, command('assign'), actor, {}), { status: 422 });
  assert.throws(() => engine.transition({ state: 'assigned', owner_subject: 'another', version: 1 }, command('start'), actor, facts), { status: 403 });
  assert.equal(engine.transition({ state: 'assigned', owner_subject: 'another', version: 1 }, command('start'),
    { subject: 'reviewer', roles: ['reviewer'] }, facts).state, 'investigating');
});
test('verification, closure and reopen fail closed when evidence/owner guards are missing', () => {
  const actor = { subject: 'reviewer', roles: ['reviewer'] };
  for (const [action, state, patch] of [['request_verification', 'investigating', { has_note: false }],
    ['request_verification', 'investigating', { evidence_count: 0 }], ['verify_close', 'awaiting_verification', { pending_links: 1 }],
    ['reopen', 'closed', { valid_owner: false }], ['reopen', 'closed', { new_reason: false }]]) {
    assert.throws(() => engine.transition({ state, owner_subject: 'owner', version: 1 }, command(action), actor, { ...facts, ...patch }), { status: 422 });
  }
});
test('same engine evaluates document_review without case-specific state logic and snapshots its definition', () => {
  const definition = structuredClone(documentReviewDefinition), other = createWorkflowEngine(definition);
  definition.transitions.approve.to = 'corrupted';
  const result = other.transition({ state: 'draft', owner_subject: null, version: 1 }, command('submit'), { subject: 'u', roles: ['operator'] }, {});
  assert.equal(result.state, 'in_review');
  assert.equal(other.transition(result, command('approve', 2), { subject: 'r', roles: ['reviewer'] }, {}).state, 'approved');
  assert.throws(() => createWorkflowEngine({ ...documentReviewDefinition, initial: 'missing' }));
});
