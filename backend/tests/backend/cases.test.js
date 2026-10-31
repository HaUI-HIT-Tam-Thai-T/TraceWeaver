// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { caseInput, caseQuery } from '../../src/validations/case.validation.js';
import { createCaseService } from '../../src/services/case.service.js';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('case service rejects invalid inputs before writes and sanitizes DB failures', async () => {
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('private-db-credentials');
  };
  const service = createCaseService({ create: fail, evidence: fail, transition: fail, get: fail });
  await assert.rejects(service.create('u', id, { run_id: id, title: ' ' }), { status: 422 });
  await assert.rejects(
    service.transition('u', id, id, { action: 'assign', reason: 'assign', expected_version: 1 }),
    { status: 422 },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    service.create('u', id, { run_id: id, title: 'Valid' }),
    (e) => e.status === 503 && !e.message.includes('private'),
  );
  await assert.rejects(service.get('u', id, id), { status: 503 });
});
test('case inputs use closed schemas, preserve opaque owner IDs, redact text and reject invalid text/expanded bounds', () => {
  assert.deepEqual(caseInput('CaseCreate', { run_id: id.toUpperCase(), title: 'token=private' }), {
    run_id: id,
    title: 'token=[REDACTED]',
  });
  assert.equal(
    caseInput('CaseTransition', {
      action: 'assign',
      reason: 'checked',
      expected_version: 1,
      owner_id: 'Owner X',
    }).owner_id,
    'Owner X',
  );
  for (const body of [
    { run_id: id, title: ' ' },
    { run_id: id, title: '\u0000' },
    { run_id: id, title: '\ud800' },
    { run_id: id, title: 'x '.repeat(146) + 'token=a' },
    { run_id: id, title: 'valid', actor: 'spoof' },
  ]) {
    assert.throws(() => caseInput('CaseCreate', body), { status: 422 });
  }
  assert.throws(
    () =>
      caseInput('CaseTransition', {
        action: 'start',
        reason: 'no assignment',
        expected_version: 1,
        owner_id: 'new-owner',
      }),
    { status: 422 },
  );
});
test('evidence validates nonblank notes, normalized unique IDs and immutable snapshot event limit', () => {
  assert.deepEqual(
    caseInput('EvidenceCreate', { kind: 'events', event_ids: [id.toUpperCase()], note: '' })
      .event_ids,
    [id],
  );
  for (const body of [
    { kind: 'note', event_ids: [], note: ' ' },
    { kind: 'events', event_ids: [], note: '' },
    { kind: 'events', event_ids: [id, id.toUpperCase()], note: '' },
  ]) {
    assert.throws(() => caseInput('EvidenceCreate', body), { status: 422 });
  }
});
test('case listing validates scalar state/owner/cursor/limit and rejects unrecognized or repeated query fields', () => {
  assert.deepEqual(caseQuery({ state: 'closed', owner_id: 'Owner X', limit: '2' }), {
    state: 'closed',
    owner_id: 'Owner X',
    limit: 2,
    cursor: undefined,
  });
  for (const query of [
    { state: 'invalid' },
    { state: '' },
    { state: ['new', 'closed'] },
    { owner_id: ['a', 'b'] },
    { owner_id: '\u0000' },
    { owner_id: '' },
    { limit: '0' },
    { q: 'unknown' },
    { cursor: '' },
  ]) {
    assert.throws(() => caseQuery(query), { status: 400 });
  }
});
