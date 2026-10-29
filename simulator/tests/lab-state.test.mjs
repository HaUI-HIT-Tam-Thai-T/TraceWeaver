// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, submitRequest, provision, changeCapacity, inspectRequest } from '../lab-state.mjs';

test('capacity failure persists across retries; repair produces independently inspectable source state', () => {
  let state = submitRequest(createLab(), { id: 'request-1', ram: 4 });
  assert.equal(inspectRequest(state, 'request-1').result, 'inconclusive');
  const original = structuredClone(state);
  state = provision(state, 'request-1', { expectedVersion: state.version, operationId: 'first' });
  state = provision(state, 'request-1', { expectedVersion: state.version, operationId: 'second' });
  assert.equal(inspectRequest(state, 'request-1').result, 'failed');
  assert.equal(state.requests[0].attempts.length, 2);
  state = changeCapacity(state, 8, state.version);
  state = provision(state, 'request-1', { expectedVersion: state.version, operationId: 'third' });
  assert.equal(inspectRequest(state, 'request-1').result, 'passed');
  assert.deepEqual(state.requests[0].attempts.map(a => a.result), ['failed', 'failed', 'passed']);
  assert.equal(original.events.length, 0);
  assert.deepEqual(provision(state, 'request-1', { expectedVersion: 0, operationId: 'third' }), state);
  assert.throws(() => changeCapacity(state, 2, state.version), /RAM_ALREADY_ALLOCATED/);
});
test('allocated resources cannot be spent twice and stale writes fail', () => {
  let state = submitRequest(createLab({ ram: 4 }), { id: 'one' });
  state = submitRequest(state, { id: 'two' });
  assert.throws(() => provision(state, 'one', { expectedVersion: 0, operationId: 'a' }), /VERSION_CONFLICT/);
  state = provision(state, 'one', { expectedVersion: state.version, operationId: 'a' });
  assert.throws(() => provision(state, 'two', { expectedVersion: state.version, operationId: 'a' }), /IDEMPOTENCY_CONFLICT/);
  state = provision(state, 'two', { expectedVersion: state.version, operationId: 'b' });
  assert.equal(inspectRequest(state, 'two').result, 'failed');
});
