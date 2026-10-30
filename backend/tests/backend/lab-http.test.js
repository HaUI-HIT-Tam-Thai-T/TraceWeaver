// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';

test('lab HTTP authenticates, rejects asserted success and keeps service errors private', async t => {
  let calls = 0;
  const server = createApp({ verifyToken: async () => ({ subject: 'operator' }), access: {},
    lab: { command: async () => { calls++; throw new Error('postgres://private-password'); },
      read: async () => ({ version: 1 }) } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/lab`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { authorization: 'Bearer test', 'content-type': 'application/json' };
  assert.equal((await fetch(url, { headers })).status, 200);
  for (const body of [{ action: 'submit', request_id: 'x', expected_version: 1 },
    { action: 'provision', request_id: 'x', operation_id: 'once', expected_version: 1, passed: true },
    { action: 'capacity', ram: -1, expected_version: 1 }]) {
    assert.equal((await fetch(`${url}/commands`, { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal(calls, 0);
  const response = await fetch(`${url}/commands`, { method: 'POST', headers,
    body: JSON.stringify({ action: 'capacity', ram: 8, expected_version: 1 }) });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private-password'));
});
