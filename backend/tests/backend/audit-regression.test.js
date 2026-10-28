// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEvent } from '../../src/core/data/event-normalizer.js';

const source = { service: 'intake', parser_version: 'intake-v1' };
const input = { source_event_id: 'audit', occurred_at: '2026-10-25T00:00:00Z', service: 'intake',
  action: 'request.accepted', outcome: 'success', identifiers: [], message: '', payload: {} };

test('redaction cannot turn an accepted record into an oversized public Event', () => {
  for (const patch of [
    { message: 'x'.repeat(4088) + ' token=a' },
    { action: 'x'.repeat(192) + ' token=a' },
    { identifiers: [{ namespace: 'request', value: 'x'.repeat(492) + ' token=a' }] },
  ]) assert.equal(normalizeEvent({ ...input, ...patch }, source).code, 'INVALID_EVENT');
  assert.ok(normalizeEvent({ ...input, message: 'x'.repeat(4096) }, source).event);
});

test('microsecond timestamps retain distinctions while equivalent and legacy millisecond inputs hash identically', () => {
  const normalized = (time) => normalizeEvent({ ...input, occurred_at: time }, source);
  const a = normalized('2026-10-25T00:00:00.123456Z');
  assert.equal(a.event.occurred_at, '2026-10-25T00:00:00.123456Z');
  assert.notEqual(a.hash, normalized('2026-10-25T00:00:00.123999Z').hash);
  assert.equal(a.hash, normalized('2026-10-25T00:00:00.123456000Z').hash);
  assert.equal(normalized('2026-10-25T00:00:00.1Z').event.occurred_at, '2026-10-25T00:00:00.100Z');
  assert.equal(normalized('2026-10-25T00:00:00.100000Z').hash, normalized('2026-10-25T00:00:00.1Z').hash);
  assert.equal(normalized('2026-10-25T00:00:00.1234567Z').code, 'UNSUPPORTED_TIMESTAMP_PRECISION');
});

