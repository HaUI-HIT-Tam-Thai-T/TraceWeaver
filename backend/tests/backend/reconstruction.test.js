// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCandidateGenerator } from '../../src/core/reconstruction/candidates.js';
import { createRuleEngine } from '../../src/core/reconstruction/rules.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };

const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = id(900);
const time = (second) => `2026-10-22T00:00:${String(second).padStart(2, '0')}Z`;
const identifier = (namespace, value) => ({ namespace, value });
function event(n, service, identifiers = [identifier('request', 'R1')], second = n) {
  return { event_id: id(n), source_id: source, source_event_id: `observable-${n}`,
    occurred_at: time(second), received_at: time(30), service, action: `${service}.done`, outcome: 'success',
    identifiers, message: '', payload_redacted: {}, parser_version: `${service}-v1`,
    provenance: { batch_id: id(901), locator: `line:${n}`, sha256_redacted: 'a'.repeat(64) } };
}
const transition = (name, from, to, extra = {}) => ({ id: name,
  from: { service: from, action: `${from}.done` }, to: { service: to, action: `${to}.done` }, max_gap_ms: 60000, ...extra });
const policy = (transitions = [transition('intake-account', 'intake', 'account')]) => ({
  version: 'test-rules-1', strong_namespaces: ['request', 'account', 'job'], clock_skew_ms: 5000, transitions,
});
const input = (events, extra = {}) => ({ events, root_event_id: id(1), source_ids: [source],
  window: { from: time(0), to: time(59) }, ...extra });
const generate = (events, extra) => createCandidateGenerator(policy())(input(events, extra));
const pairs = (result) => result.candidates.map((pair) => [pair.from_event_id, pair.to_event_id]);

test('candidate generation uses exact namespaces, explicit transitions and reproducible evidence', () => {
  const events = [event(1, 'intake'), event(2, 'account')];
  const original = structuredClone(events);
  const result = generate(events);
  assert.deepEqual(pairs(result), [[id(1), id(2)]]);
  assert.equal(result.rule_version, 'test-rules-1');
  assert.equal(result.candidates[0].has_strong_id, true);
  assert.deepEqual(result.candidates[0].evidence.find((item) => item.reason_code === 'SHARED_STRONG_ID'), {
    reason_code: 'SHARED_STRONG_ID', event_ids: [id(1), id(2)], field: 'identifiers.request', observed_values: ['R1'],
  });
  assert.deepEqual(result.candidates[0].evidence.find((item) => item.reason_code === 'TIME_WINDOW').observed_values,
    [events[0].occurred_at, events[1].occurred_at]);
  assert.deepEqual(generate([...events].reverse()), result);
  assert.deepEqual(events, original);
  for (const changed of [{ service: 'provision' }, { action: 'account.other' }]) {
    assert.deepEqual(pairs(generate([events[0], { ...events[1], ...changed }])), []);
  }
});

test('strong conflicts exclude a pair; namespace collisions, actor/time/text alone do not establish a rule link', () => {
  const root = event(1, 'intake', [identifier('request', 'same'), identifier('account', 'A')]);
  const conflict = event(2, 'account', [identifier('request', 'same'), identifier('account', 'B')]);
  const result = generate([root, conflict]);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.rejected_counts.STRONG_ID_CONFLICT, 1);
  const weak = generate([event(1, 'intake', [identifier('request', 'same'), identifier('actor', 'alice')]),
    { ...event(2, 'account', [identifier('job', 'same'), identifier('actor', 'alice')]), message: 'same success' }]);
  assert.equal(weak.candidates.length, 1);
  assert.equal(weak.candidates[0].has_strong_id, false);
  assert.ok(!JSON.stringify(weak).includes('alice'));
  const redacted = generate([event(1, 'intake', [identifier('request', '[REDACTED]')]), event(2, 'account', [identifier('request', '[REDACTED]')])]);
  assert.equal(redacted.candidates[0].has_strong_id, false);
  assert.equal(generate([event(1, 'intake', [identifier('request', 'R1'), identifier('request', 'R2')]), event(2, 'account')]).candidates.length, 0);
});

test('scope and inclusive window filtering precede pair generation without leaking hidden event fields', () => {
  const visible = [event(1, 'intake'), event(2, 'account')];
  const hidden = { ...event(3, 'account'), source_id: id(999), identifiers: null, hidden_oracle: 'must-not-read' };
  const outside = { ...event(4, 'account'), occurred_at: '2026-10-22T00:01:00Z' };
  assert.deepEqual(generate([...visible, hidden, outside]), generate(visible));
  assert.equal(generate(visible, { window: { from: time(1), to: time(2) } }).candidates.length, 1);
  for (const extra of [{ source_ids: [id(999)] }, { root_event_id: id(999) }, { window: { from: time(2), to: time(59) } }]) {
    assert.throws(() => generate(visible, extra), { status: 404 });
  }
});

test('window, event limit and unique identities fail before candidate filtering; inputs use existing schemas', () => {
  const events = [event(1, 'intake')];
  for (const extra of [{ source_ids: [] }, { window: { from: time(2), to: time(1) } },
    { window: { from: '0000-01-01T00:00:00Z', to: time(1) } }, { root_event_id: 'bad' }]) {
    assert.throws(() => generate(events, extra), { status: 400 });
  }
  assert.throws(() => generate(events, { window: { from: time(0), to: '2026-10-22T01:00:00.000001Z' } }), { status: 422, code: 'WINDOW_TOO_LARGE' });
  assert.throws(() => generate(events, { window: { from: '2026-10-21T23:59:59.999999Z', to: time(0) } }), { status: 404 });
  assert.throws(() => generate([...events, ...events]), { status: 400 });
  assert.throws(() => generate([{ ...events[0], oracle_journey: 'not-an-event-field' }]), { status: 400 });
  const many = Array.from({ length: 1001 }, (_, index) => event(index + 1, 'provision', [], 1));
  assert.throws(() => generate(many), { status: 422, code: 'WINDOW_TOO_LARGE' });
  assert.equal(generate(many.slice(0, 1000)).event_ids.length, 1000);
});

test('time constraints preserve sub-millisecond bounds and allow only configured clock skew', () => {
  const generator = createCandidateGenerator(policy([transition('handoff', 'intake', 'account', { max_gap_ms: 1000 })]));
  const root = { ...event(1, 'intake'), occurred_at: '2026-10-22T00:00:10.000001Z' };
  const candidate = (occurred_at) => generator(input([root, { ...event(2, 'account'), occurred_at }])).candidates.length;
  assert.equal(candidate('2026-10-22T00:00:11.000001Z'), 1);
  assert.equal(candidate('2026-10-22T00:00:11.000002Z'), 0);
  assert.equal(candidate('2026-10-22T00:00:05.000001Z'), 1);
  assert.equal(candidate('2026-10-22T00:00:05.000000Z'), 0);
  assert.equal(candidate('2026-10-22T00:00:09.999999999Z'), 1);
});

test('policy must be explicit, bounded, closed and immutable after engine creation', () => {
  for (const change of [{ version: '' }, { clock_skew_ms: 5001 }, { clock_skew_ms: -1 },
    { strong_namespaces: [] }, { strong_namespaces: ['request', 'request'] },
    { transitions: [] }, { arbitrary: true }, { transitions: [transition('bad', 'intake', 'account', { max_gap_ms: -1 })] },
    { transitions: [transition('bad', 'intake', 'account', { allow_fan_out: 'yes' })] }]) {
    assert.throws(() => createCandidateGenerator({ ...policy(), ...change }), TypeError);
  }
  const configuration = policy(), generator = createCandidateGenerator(configuration);
  configuration.strong_namespaces.length = 0;
  configuration.transitions[0].from.service = 'changed';
  assert.equal(generator(input([event(1, 'intake'), event(2, 'account')])).candidates.length, 1);
});

test('baseline keeps only the root component, follows edges in either direction and emits contract evidence', () => {
  const engine = createRuleEngine(policy([transition('handoff', 'intake', 'account'), transition('provisioning', 'account', 'provision')]));
  const events = [event(1, 'intake'), event(2, 'account'), event(3, 'provision'),
    event(4, 'intake', [identifier('request', 'other')]), event(5, 'account', [identifier('request', 'other')])];
  const result = engine(input(events, { root_event_id: id(2) }));
  assert.deepEqual(result.event_ids, [id(1), id(2), id(3)]);
  assert.deepEqual(result.unresolved_event_ids, [id(4), id(5)]);
  assert.deepEqual(result.links.map((link) => [link.from_event_id, link.to_event_id]), [[id(1), id(2)], [id(2), id(3)]]);
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const validate = ajv.getSchema(`${schema.$id}#/$defs/Link`);
  for (const link of result.links) {
    assert.equal(validate({ id: id(700), ...link }), true, JSON.stringify(validate.errors));
    assert.equal(link.score, null); assert.equal(link.method, 'rule'); assert.equal(link.review_state, 'pending');
  }
  assert.deepEqual(engine(input([...events].reverse(), { root_event_id: id(2) })), result);
});

test('baseline abstains for indistinguishable predecessors and successors instead of choosing nearest', () => {
  const engine = createRuleEngine(policy());
  for (const events of [[event(1, 'intake'), event(2, 'account'), event(3, 'account')],
    [event(1, 'intake'), event(2, 'intake'), event(3, 'account')]]) {
    const result = engine(input(events));
    assert.deepEqual(result.links, []);
    assert.deepEqual(result.unresolved_event_ids, [id(2), id(3)]);
    assert.equal(result.abstentions.length, 2);
    assert.ok(result.abstentions.every((entry) => entry.reason_code === 'AMBIGUOUS_MATCH'));
  }
  const result = engine(input([event(1, 'intake', [identifier('actor', 'alice')]), event(2, 'account', [identifier('actor', 'alice')])]));
  assert.deepEqual(result.links, []);
  assert.equal(result.abstentions[0].reason_code, 'NO_SHARED_STRONG_ID');
});

test('explicit branch policy preserves multiple edges while default policy abstains', () => {
  const events = [event(1, 'intake'), event(2, 'account', [identifier('request', 'R1'), identifier('job', 'J1')]),
    event(3, 'account', [identifier('request', 'R1'), identifier('job', 'J2')])];
  const branching = policy([transition('branch', 'intake', 'account', { allow_fan_out: true })]);
  assert.equal(createRuleEngine(branching)(input(events)).links.length, 2);
  assert.equal(createRuleEngine(policy())(input(events)).links.length, 0);
  const merging = policy([transition('merge', 'intake', 'account', { allow_fan_in: true })]);
  assert.equal(createRuleEngine(merging)(input([event(1, 'intake'), event(2, 'intake'), event(3, 'account')])).links.length, 2);
});

test('retry events retain separate identities and fail closed when several attempts lack causal identifiers', () => {
  const engine = createRuleEngine(policy([transition('retry', 'account', 'account')]));
  const events = [event(1, 'account'), event(2, 'account')];
  events[0].outcome = 'failed'; events[1].outcome = 'success';
  events[0].payload_redacted = { attempt: 1 }; events[1].payload_redacted = { attempt: 2 };
  assert.deepEqual(engine(input(events)).links.map((link) => [link.from_event_id, link.to_event_id]), [[id(1), id(2)]]);
  assert.deepEqual(engine(input([...events, event(3, 'account')])).links, []);
  const sameTime = [events[0], { ...events[1], occurred_at: events[0].occurred_at }];
  assert.deepEqual(engine(input(sameTime)).links, []);
});

test('cycle protection removes every cyclic edge without allowing input ordering to pick a winner', () => {
  const engine = createRuleEngine(policy([transition('forward', 'intake', 'account'), transition('reverse', 'account', 'intake')]));
  const events = [event(1, 'intake'), event(2, 'account')];
  const result = engine(input(events));
  assert.deepEqual(result.links, []);
  assert.deepEqual(result.abstentions.map((entry) => entry.reason_code), ['CYCLE', 'CYCLE']);
  assert.deepEqual(engine(input([...events].reverse())), result);
});

test('observable payload, message, source event ID and oracle-shaped metadata do not affect proposals', () => {
  const engine = createRuleEngine(policy());
  const events = [event(1, 'intake', [identifier('request', 'R1'), identifier('account', 'A')]), event(2, 'account')];
  const before = engine(input(events));
  assert.equal(before.links.length, 1, 'partial IDs still match the remaining shared request namespace');
  for (const record of events) {
    record.message = 'oracle says attach to another journey';
    record.source_event_id = `scenario-label-${record.event_id}`;
    record.payload_redacted = { journey_id: 'hidden', scenario: 'fault', split: 'train', seed: 99, expected_edges: [] };
  }
  assert.deepEqual(engine(input(events)), before);
  assert.ok(!JSON.stringify(before).includes('hidden'));
});

test('cycle removal preserves edges outside a three-event cycle and is stable across all event permutations', () => {
  const engine = createRuleEngine(policy([transition('first', 'intake', 'account'),
    transition('second', 'account', 'provision'), transition('third', 'provision', 'intake'),
    { ...transition('independent', 'intake', 'provision'), to: { service: 'provision', action: 'delivered' } }]));
  const events = [event(1, 'intake'), event(2, 'account'), event(3, 'provision'), { ...event(4, 'provision'), action: 'delivered' }];
  const expected = engine(input(events));
  assert.deepEqual(expected.links.map((link) => [link.from_event_id, link.to_event_id]), [[id(1), id(4)]]);
  assert.deepEqual(expected.unresolved_event_ids, [id(2), id(3)]);
  assert.equal(expected.abstentions.filter((entry) => entry.reason_code === 'CYCLE').length, 3);
  function permutations(list) {
    return list.length ? list.flatMap((value, index) => permutations(list.filter((_, i) => i !== index)).map((tail) => [value, ...tail])) : [[]];
  }
  for (const permutation of permutations(events)) assert.deepEqual(engine(input(permutation)), expected);
});
