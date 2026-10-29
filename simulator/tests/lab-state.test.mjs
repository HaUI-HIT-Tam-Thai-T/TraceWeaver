// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, submitRequest, provision, changeCapacity, changeCondition, inspectRequest } from '../lab-state.mjs';

test('combined faults require real retries; wrong resource and partial repairs cannot pass', () => {
  let s = submitRequest(createLab(), { id: 'combined', image_available: false, account_active: false });
  const run = id => { s = provision(s, 'combined', { expectedVersion: s.version, operationId: id }); };
  const repair = (action, extra) => { s = changeCondition(s, { action, request_id: 'combined', expected_version: s.version, ...extra }); };
  run('one');
  assert.deepEqual(s.requests[0].attempts[0].blockers, ['INSUFFICIENT_RAM', 'IMAGE_UNAVAILABLE', 'ACCOUNT_DISABLED']);
  s = changeCapacity(s, 8, s.version);
  run('two');
  assert.equal(inspectRequest(s, 'combined').attempt.reason, 'IMAGE_UNAVAILABLE');
  assert.throws(() => repair('image', { image_id: 'wrong', available: true }), /RESOURCE_MISMATCH/);
  repair('image', { image_id: s.requests[0].image_id, available: true });
  run('three');
  assert.equal(inspectRequest(s, 'combined').attempt.reason, 'ACCOUNT_DISABLED');
  repair('account', { account_id: s.requests[0].account_id, active: true });
  assert.notEqual(inspectRequest(s, 'combined').result, 'passed');
  run('four');
  assert.equal(inspectRequest(s, 'combined').result, 'passed');
  run('five');
  assert.equal(inspectRequest(s, 'combined').result, 'passed');
  assert.equal(s.requests[0].environment.ram, 4);
  repair('account', { account_id: s.requests[0].account_id, active: false });
  assert.notEqual(inspectRequest(s, 'combined').result, 'passed');
  run('six');
  assert.equal(inspectRequest(s, 'combined').result, 'failed');
  assert.equal(s.requests[0].attempts[3].result, 'passed');
});

test('checker rejects inconsistent outcomes, allocations, check lists and stale executions', () => {
  let s = submitRequest(createLab({ ram: 8 }), { id: 'proof' });
  s = provision(s, 'proof', { expectedVersion: s.version, operationId: 'ok' });
  for (const corrupt of [
    r => { r.attempts[0].result = 'failed'; },
    r => { r.environment.ram = 1; },
    r => { r.environment.image_id = 'wrong'; },
    r => { r.attempts[0].checks = []; },
    r => { r.account_active = false; },
  ]) {
    const copy = structuredClone(s); corrupt(copy.requests[0]);
    assert.notEqual(inspectRequest(copy, 'proof').result, 'passed');
  }
  assert.notEqual(inspectRequest(changeCapacity(s, 9, s.version), 'proof').result, 'passed');
});

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
