// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function apiClient(baseUrl, token, fetchImpl = fetch) {
  const url = new URL(baseUrl);
  assert.ok(
    url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)),
    'HTTPS or loopback API required',
  );
  assert.ok(
    url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash,
    'API origin required',
  );
  assert.ok(typeof token === 'string' && token.trim(), 'Access token required');
  return async (path, body, key) => {
    assert.ok(
      path.startsWith('/api/v1/') && !/[\\#\s]/.test(path) && !path.includes('..'),
      'API path required',
    );
    assert.ok(
      new URL(path, url.origin).pathname.startsWith('/api/v1/'),
      'Normalized API path required',
    );
    const response = await fetchImpl(url.origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`SIMULATOR_HTTP_${response.status}`);
    return response.json();
  };
}

export async function uploadDataset(dataset, { workspaceId, sources, request }) {
  assert.match(workspaceId, uuid);
  for (const service of ['intake', 'account', 'provision']) assert.match(sources[service], uuid);
  const event_ids = {},
    batches = [],
    counters = { accepted: 0, duplicate: 0, rejected: 0 };
  for (const delivery of dataset.deliveries) {
    // Sequential delivery preserves late-arrival, duplicate and conflict test semantics.
    const result = await request(
      `/api/v1/workspaces/${workspaceId}/sources/${sources[delivery.event.service]}/events:batch`,
      { events: [delivery.event] },
    );
    assert.equal(result.results.length, 1, 'One result per delivered record required');
    const item = result.results[0];
    const allowed =
      delivery.expected_status === 'accepted'
        ? ['accepted', 'duplicate']
        : [delivery.expected_status];
    assert.ok(
      allowed.includes(item.status),
      `Unexpected ingestion result for ${delivery.event.source_event_id}`,
    );
    if (delivery.expected_code) assert.equal(item.code, delivery.expected_code);
    assert.ok(Object.hasOwn(counters, item.status), 'Unknown ingestion status');
    counters[item.status]++;
    if (item.event_id) event_ids[delivery.event.source_event_id] = item.event_id;
    batches.push(result.batch_id);
  }
  assert.equal(
    Object.keys(event_ids).length,
    dataset.events.length,
    'Every unique event must be stored',
  );
  return {
    dataset: dataset.manifest.dataset,
    workspace_id: workspaceId,
    ...counters,
    event_ids,
    batches,
  };
}
