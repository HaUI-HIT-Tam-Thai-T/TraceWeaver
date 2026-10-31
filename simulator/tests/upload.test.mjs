// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateDataset } from '../generate.mjs';
import { apiClient, uploadDataset } from '../upload.mjs';
const id = '10000000-0000-4000-8000-000000000015';

test('HTTP client constrains destination, rejects redirects, uses token and bounds wait', async () => {
  let sent;
  const request = apiClient('https://api.example.test', 'private-token', async (...args) => {
    sent = args;
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await request('/api/v1/test', { events: [] });
  assert.equal(sent[1].redirect, 'error');
  assert.equal(sent[1].headers.Authorization, 'Bearer private-token');
  assert.ok(sent[1].signal instanceof AbortSignal);
  for (const path of ['https://evil.test/', '/api/v1/../identity', '/api/v1/%2e%2e/identity'])
    await assert.rejects(request(path));
  for (const url of [
    'http://example.test',
    'https://user:pass@example.test',
    'https://example.test/path',
  ])
    assert.throws(() => apiClient(url, 'token'));
  await assert.rejects(
    apiClient('https://example.test', 'token', async () => ({ ok: false, status: 503 }))(
      '/api/v1/me',
    ),
    /SIMULATOR_HTTP_503/,
  );
});

test('upload checks conflict results, deduplicates rerun and never sends oracle metadata', async () => {
  const d = generateDataset({ count: 12 }),
    stored = new Map();
  let calls = 0;
  const request = async (path, body) => {
    calls++;
    assert.equal(body.events.length, 1);
    assert.match(path, /events:batch$/);
    assert.deepEqual(Object.keys(body), ['events']);
    const e = body.events[0],
      bytes = JSON.stringify(e),
      old = stored.get(e.source_event_id);
    const item =
      old && old !== bytes
        ? { status: 'rejected', code: 'SOURCE_EVENT_CONFLICT' }
        : { status: old ? 'duplicate' : 'accepted', event_id: id };
    if (!old) stored.set(e.source_event_id, bytes);
    return { batch_id: id, results: [item] };
  };
  const args = { workspaceId: id, sources: { intake: id, account: id, provision: id }, request };
  const first = await uploadDataset(d, args),
    second = await uploadDataset(d, args);
  assert.equal(first.accepted, d.events.length);
  assert.equal(first.rejected, 1);
  assert.equal(first.duplicate, 1);
  assert.equal(second.accepted, 0);
  assert.equal(second.rejected, 1);
  assert.equal(second.duplicate, d.deliveries.length - 1);
  assert.equal(calls, d.deliveries.length * 2);
  await assert.rejects(
    uploadDataset(d, {
      ...args,
      request: async () => ({ batch_id: id, results: [{ status: 'rejected', code: 'FORBIDDEN' }] }),
    }),
  );
});
