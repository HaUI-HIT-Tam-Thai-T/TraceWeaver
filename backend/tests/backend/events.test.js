// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { eventQuery } from '../../src/validations/event.validation.js';
import { createEventCursorCodec } from '../../src/core/identity/event-cursor.js';

const id = '11111111-1111-4111-8111-111111111111';
test('event query validates bounds, UTC timestamps, scalar filters and closed query shape', () => {
  assert.deepEqual(eventQuery({}), { limit: 50, cursor: undefined, source_id: '', from: '', to: '', q: '', action: '' });
  assert.equal(eventQuery({ limit: '100', source_id: id.toUpperCase(), q: '%_', action: 'accepted' }).source_id, id);
  for (const query of [{ limit: '0' }, { limit: '101' }, { limit: '1.5' }, { q: '' }, { q: ['a', 'b'] }, { action: 'x'.repeat(201) }, { source_id: 'bad' }, { from: 'bad' }, { from: '2026-02-30T00:00:00Z' }, { from: '2026-10-21T00:00:00+07:00' }, { from: '2026-10-22T00:00:00Z', to: '2026-10-21T00:00:00Z' }, { actor: 'admin' }, { cursor: '' }]) assert.throws(() => eventQuery(query), { status: 400 });
});
test('event cursors bind context and protect exact snapshot and composite last key', () => {
  const codec = createEventCursorCodec('event-cursor-secret-at-least-32-characters');
  const context = { subject: 'alice', workspace: id, scope: 'grants-v1', filters: 'filter-hash', sort: 'occurred_at,event_id' };
  const position = { snapshot: '10:20:12,15', occurred_at: '2026-10-19T03:00:00.123456Z', event_id: id };
  const cursor = codec.encode(context, position);
  assert.deepEqual(codec.decode(cursor, context), position);
  for (const field of Object.keys(context)) assert.throws(() => codec.decode(cursor, { ...context, [field]: 'changed' }), { status: 400 });
  for (const value of [`${cursor}!`, cursor.replace(/^./, cursor[0] === 'a' ? 'b' : 'a'), 'bad', 'x'.repeat(4097)]) assert.throws(() => codec.decode(value, context), { status: 400 });
  assert.throws(() => codec.encode(context, { ...position, snapshot: 'not-a-snapshot' }));
  assert.throws(() => createEventCursorCodec('short'));
});
