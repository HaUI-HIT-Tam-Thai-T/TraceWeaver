// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEvent } from '../../src/core/data/event-normalizer.js';
import { validBatch } from '../../src/validations/ingestion.validation.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { createApp } from '../../src/app.js';
import { once } from 'node:events';
import { ApiError } from '../../src/core/identity/api-error.js';
const source = { service: 'intake', parser_version: 'intake-v1' };
const record = { source_event_id: '42', occurred_at: '2026-10-19T03:00:00Z', service: 'intake', action: 'request.accepted', outcome: 'success', identifiers: [], message: 'ok', payload: {} };

test('batch envelope accepts invalid records independently; bounds and unknown fields rejected', () => {
  assert.ok(validBatch({ events: [record, null] }));
  for (const body of [{ events: [] }, { events: Array(501).fill(record) }, { events: [record], actor: 'admin' }, null]) assert.equal(validBatch(body), false);
});
test('record validation rejects server fields, bad date, missing ID and mismatched source', () => {
  for (const patch of [{ received_at: '2026-10-19T03:00:00Z' }, { occurred_at: 'invalid' }, { occurred_at: '0000-01-01T00:00:00Z' }, { source_event_id: '' }, { outcome: 'other' }]) assert.equal(normalizeEvent({ ...record, ...patch }, source).code, 'INVALID_EVENT');
  assert.equal(normalizeEvent({ ...record, service: 'account' }, source).code, 'SOURCE_SERVICE_MISMATCH');
  assert.equal(normalizeEvent(record, { ...source, parser_version: 'future' }).code, 'UNSUPPORTED_PARSER');
});
test('registered normalized adapters accept each source service only', () => {
  for (const service of ['intake', 'account', 'provision']) {
    const result = normalizeEvent({ ...record, service }, { service, parser_version: `${service}-v1` });
    assert.equal(result.event.parser_version, `${service}-v1`);
  }
});
test('redacts nested secrets and message credentials without mutating input; canonical hashes stable', () => {
  const raw = { ...record, payload: { password: 'hidden', nested: [{ access_token: 'hidden2', safe: 'yes' }] }, message: 'password=hidden Bearer abc.def.ghi' };
  const result = normalizeEvent(raw, source);
  assert.doesNotMatch(JSON.stringify(result), /hidden|abc\.def/);
  assert.equal(raw.payload.password, 'hidden');
  assert.equal(normalizeEvent({ ...record, payload: { a: 1, b: 2 } }, source).hash, normalizeEvent({ ...record, payload: { b: 2, a: 1 } }, source).hash);
  assert.notEqual(normalizeEvent(record, source).hash, normalizeEvent({ ...record, message: 'changed' }, source).hash);
});
test('deep payloads reject safely instead of overflowing stack', () => {
  let payload = {}; for (let i = 0; i < 40; i++) payload = { nested: payload };
  assert.equal(normalizeEvent({ ...record, payload }, source).code, 'INVALID_EVENT');
});
test('JSONB-incompatible strings and non-finite payload values reject per record', () => {
  for (const payload of [{ value: '\u0000' }, { value: '\ud800' }, { value: Infinity }, { ['bad\u0000key']: 1 }]) {
    assert.equal(normalizeEvent({ ...record, payload }, source).code, 'INVALID_EVENT');
  }
});

test('service passes only sanitized records, rejects envelope before writing and sanitizes DB failures', async () => {
  let calls = 0;
  const service = createIngestionService({ async ingest(subject, workspace, id, prepare) {
    calls++;
    const batch = prepare(source);
    assert.deepEqual(batch.items.map((r) => r.code ?? 'valid'), ['valid', 'INVALID_EVENT']);
    assert.doesNotMatch(JSON.stringify(batch), /hidden/);
    return { ok: true };
  } });
  await assert.rejects(service.batch('u', 'w', 's', { events: [] }), { status: 422 });
  assert.equal(calls, 0);
  assert.deepEqual(await service.batch('u', 'w', 's', { events: [{ ...record, payload: { password: 'hidden' } }, null] }), { ok: true });
  const unavailable = createIngestionService({ ingest: async () => { throw Error('postgres password=hidden'); } });
  await assert.rejects(unavailable.batch('u', 'w', 's', { events: [record] }), (error) => error.status === 503 && !error.message.includes('hidden'));
});

test('batch HTTP route authenticates, matches literal colon and applies body/query/ID bounds', async (t) => {
  let calls = 0;
  const server = createApp({ checkReadiness: async () => true, access: {},
    verifyIngestToken: async (token) => { if (token !== 'valid') throw new ApiError(401, 'INVALID_TOKEN', 'Invalid token'); return { subject: 'u' }; },
    ingestion: createIngestionService({ async ingest(subject, workspace, id, prepare) {
      calls++;
      assert.equal(subject, 'u');
      const { items } = prepare(source);
      return { count: items.length };
    } }),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/11111111-1111-4111-8111-111111111111/sources/22222222-2222-4222-8222-222222222222/events`;
  const send = (suffix, body, token = 'valid') => fetch(base + suffix, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await send(':batch', { events: [record] }, null)).status, 401);
  assert.equal((await send(':batch', { events: [record] }, 'invalid')).status, 401);
  assert.equal((await send('wrong', { events: [record] })).status, 404);
  assert.equal((await send(':batch?actor=admin', { events: [record] })).status, 400);
  assert.equal((await send(':batch', { events: [] })).status, 422);
  assert.equal((await send(':batch', { events: [record], large: 'x'.repeat(1048576) })).status, 413);
  const response = await send(':batch', { events: [record, null] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { count: 2 });
  assert.equal(calls, 1);
});
