// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkflowRepository } from '../../src/core/workflow/repository.js';
import { documentReviewDefinition } from '../../src/core/workflow/definitions.js';

function fixture(definition, roles, options = {}) {
  let row, history = [], writes = 0;
  const client = {
    async query(sql, params = []) {
      if (sql.includes('AS roles')) return { rows: [{ roles: [...roles], sources: [] }] };
      if (sql.startsWith('SELECT 1 FROM core.memberships')) return { rowCount: 1, rows: [{}] };
      if (sql.startsWith('INSERT INTO core.workflow_instances')) {
        writes++;
        row = { id: params[0], workspace_id: params[1], definition_key: params[2], definition_version: params[3],
          definition: structuredClone(params[4]), entity_type: params[5], entity_id: params[6] };
      }
      if (sql.startsWith('INSERT INTO core.workflow_history')) {
        writes++;
        const h = { version: params[2], from_state: params[3], to_state: params[4], owner_subject: params[5],
          actor_subject: params[6], action: params[7], reason: params[8], evidence_refs: params[9], occurred_at: new Date() };
        history.push(h); return { rows: [h] };
      }
      if (sql.includes('SELECT i.*,h.to_state')) return { rows: row ? [{ ...row, ...history.at(-1), history: [...history] }] : [] };
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const pool = { query: client.query, connect: async () => client };
  const repo = createWorkflowRepository(pool, { definitions: [{ definition, entityType: 'document', ...options }] });
  const input = { definition_key: definition.key, definition_version: definition.version,
    entity_ref: { type: 'document', id: '20000000-0000-4000-8000-000000000002' } };
  return { repo, roles, input, get writes() { return writes; } };
}
const definition = { key: 'admin_approval', version: 1, initial: 'draft', states: ['draft', 'approved'],
  transitions: { approve: { from: ['draft'], to: 'approved', roles: ['admin'], guards: [] } } };
const app = 'trusted-app', subject = 'actor', workspace = '10000000-0000-4000-8000-000000000001';

test('registered admin-only workflow can create and transition without TraceWeaver writer roles', async () => {
  const f = fixture(definition, ['admin']);
  const created = await f.repo.create(app, subject, workspace, f.input);
  assert.equal(created.state, 'draft');
  const updated = await f.repo.transition(app, subject, workspace, created.id,
    { action: 'approve', expected_version: 1, reason: 'Reviewed', evidence_refs: [] });
  assert.equal(updated.state, 'approved'); assert.equal(updated.version, 2);
});

test('definition creation policy rejects unrelated roles and cannot be supplied by the caller', async () => {
  for (const role of ['viewer', 'operator', 'reviewer']) {
    const f = fixture(definition, [role]);
    await assert.rejects(f.repo.create(app, subject, workspace, { ...f.input, createRoles: [role] }), { status: 403 });
    assert.equal(f.writes, 0);
  }
});

test('document creation keeps operator/reviewer policy and admin cannot approve its transitions', async () => {
  for (const role of ['viewer', 'admin']) {
    const f = fixture(documentReviewDefinition, [role], { createRoles: ['operator', 'reviewer'] });
    await assert.rejects(f.repo.create(app, subject, workspace, f.input), { status: 403 });
  }
  const f = fixture(documentReviewDefinition, ['operator'], { createRoles: ['operator', 'reviewer'] });
  const doc = await f.repo.create(app, subject, workspace, f.input);
  await f.repo.transition(app, subject, workspace, doc.id,
    { action: 'submit', expected_version: 1, reason: 'Ready', evidence_refs: [] });
  f.roles.splice(0, f.roles.length, 'admin');
  await assert.rejects(f.repo.transition(app, subject, workspace, doc.id,
    { action: 'approve', expected_version: 2, reason: 'Review', evidence_refs: [] }), { status: 403 });
});
