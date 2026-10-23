// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewInput, manualLinkInput } from '../../src/validations/review.validation.js';
import { assertAcyclicLink, graphProjection } from '../../src/core/reconstruction/reviews.js';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('review inputs reuse closed contracts, normalize IDs and redact reasons before persistence', () => {
  assert.deepEqual(reviewInput({ decision: 'accepted', reason: 'token=private', expected_version: 1 }),
    { decision: 'accepted', reason: 'token=[REDACTED]', expected_version: 1 });
  assert.equal(manualLinkInput({ from_event_id: a.toUpperCase(), to_event_id: b, reason: 'observed' }).from_event_id, a);
  for (const patch of [{ reason: ' ' }, { reason: '\u0000' }, { reason: '\ud800' }, { actor_subject: 'spoof' },
    { decision: 'pending' }, { expected_version: 0 }, { expected_version: 1.1 }]) {
    assert.throws(() => reviewInput({ decision: 'accepted', reason: 'observed', expected_version: 1, ...patch }), { status: 422 });
  }
  assert.throws(() => manualLinkInput({ from_event_id: a, to_event_id: a, reason: 'self' }), { status: 422 });
});
test('cycle guard covers pending and accepted paths, excludes rejected edges and supports reacceptance', () => {
  const links = [{ id: '1', from_event_id: 'a', to_event_id: 'b', review_state: 'pending' },
    { id: '2', from_event_id: 'b', to_event_id: 'c', review_state: 'accepted' }];
  assert.throws(() => assertAcyclicLink(links, 'c', 'a'), { status: 422, code: 'LINK_CYCLE' });
  assert.doesNotThrow(() => assertAcyclicLink([{ ...links[0], review_state: 'rejected' }, links[1]], 'c', 'a'));
  assert.doesNotThrow(() => assertAcyclicLink(links, 'a', 'c'));
  assert.throws(() => assertAcyclicLink([], 'a', 'a'), { status: 422 });
});
test('graph projection recomputes root component through active edges while preserving rejected evidence', () => {
  const nodes = [{ event_id: 'a', service: 'intake', action: 'request.accepted' },
    { event_id: 'b', service: 'account', action: 'account.created' },
    { event_id: 'c', service: 'provision', action: 'provision.failed' }];
  const links = [{ from_event_id: 'a', to_event_id: 'b', review_state: 'rejected' },
    { from_event_id: 'b', to_event_id: 'c', review_state: 'accepted' }];
  const graph = graphProjection('a', nodes, links);
  assert.deepEqual(graph.unresolved_event_ids, ['b', 'c']);
  assert.deepEqual(graph.missing_expected_steps.map((step) => step.step), ['account', 'provision']);
  assert.deepEqual(graphProjection('c', nodes, links).unresolved_event_ids, ['a']);
  assert.equal(links[0].review_state, 'rejected');
});
