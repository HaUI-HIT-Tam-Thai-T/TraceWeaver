// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLab,
  submitRequest,
  provision,
  changeCondition,
  changeCapacity,
  inspectRequest,
} from '../../../simulator/lab-state.mjs';
import { verifiedClosure } from '../../src/core/data/case-verification.js';

function fixture() {
  let state = submitRequest(createLab({ ram: 8 }), { id: 'bound', ram: 2 });
  state = provision(state, 'bound', { expectedVersion: state.version, operationId: 'bound-run' });
  const observation = {
    ...inspectRequest(state, 'bound'),
    delivery: { status: 'delivered', total: 1, delivered: 1 },
  };
  const proof = { id: 'proof', document: { observation } };
  const row = { id: 'case', run_id: 'run', version: 4 };
  return { state, proof, row };
}
// Query adapter exercises the closure policy without relaxing source binding or current ACL checks.
function clientFor(state, proof, delivery = { total: 1, delivered: 1 }) {
  return {
    query: async (sql) => {
      if (sql.includes('FROM core.lab_sandboxes'))
        return { rows: [{ document: state, source_ids: ['source'] }] };
      if (sql.includes('FROM core.memberships m'))
        return { rows: [{ roles: ['reviewer'], sources: ['source'] }] };
      if (sql.includes('FROM core.reconstruction_runs'))
        return {
          rows: [{ document: { identifiers: [{ namespace: 'request', value: 'bound' }] } }],
        };
      if (sql.includes('count(*)')) return { rows: [delivery] };
      if (sql.includes('FROM core.case_verifications')) return { rows: proof ? [proof] : [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}
const close = (state, proof, row, delivery) =>
  verifiedClosure(clientFor(state, proof, delivery), 'reviewer', 'workspace', row);

test('closure keeps the same passing proof after unrelated source commands', async () => {
  const { state: original, proof, row } = fixture();
  const saved = structuredClone(proof);
  let state = submitRequest(original, { id: 'other', ram: 2, image_available: false });
  state = provision(state, 'other', {
    expectedVersion: state.version,
    operationId: 'other-failed',
  });
  state = changeCondition(state, {
    action: 'image',
    request_id: 'other',
    image_id: 'lab-image-other',
    available: true,
    expected_version: state.version,
  });
  state = provision(state, 'other', {
    expectedVersion: state.version,
    operationId: 'other-passed',
  });
  assert.notEqual(proof.document.observation.source_version, state.version);
  assert.equal((await close(state, proof, row)).verification_id, proof.id);
  assert.deepEqual(proof, saved);
});

test('closure rejects changed own conditions, capacity, new attempts, incomplete delivery and mismatched proof', async () => {
  const { state, proof, row } = fixture();
  const reject = (current, saved = proof, delivery) =>
    assert.rejects(close(current, saved, row, delivery), (e) => e.code === 'VERIFICATION_REQUIRED');
  let changed = changeCondition(state, {
    action: 'account',
    request_id: 'bound',
    account_id: 'lab-account-bound',
    active: false,
    expected_version: state.version,
  });
  changed = changeCondition(changed, {
    action: 'account',
    request_id: 'bound',
    account_id: 'lab-account-bound',
    active: true,
    expected_version: changed.version,
  });
  await reject(changed);
  await reject(changeCapacity(state, 9, state.version));
  await reject(
    provision(state, 'bound', { expectedVersion: state.version, operationId: 'new-attempt' }),
  );
  await reject(state, proof, { total: 1, delivered: 0 });
  await reject(state, null);
  for (const corrupt of [
    (o) => {
      o.result = 'failed';
    },
    (o) => {
      o.delivery.status = 'pending';
    },
    (o) => {
      o.request_id = 'other';
    },
    (o) => {
      o.attempt.source_version++;
    },
    (o) => {
      o.environment.id = 'other';
    },
    (o) => {
      o.checker_version = 'old';
    },
  ]) {
    const saved = structuredClone(proof);
    corrupt(saved.document.observation);
    await reject(state, saved);
  }
});
