// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { labCommand } from '../../src/validations/lab.validation.js';

test('case sandbox binds request server-side and rejects forged success, request and versions', async t => {
  const calls = [];
  const server = createApp({ verifyToken: async () => ({ subject: 'operator' }), access: {},
    cases: { sandbox: async (...args) => { calls.push(args); return { observation: { result: 'failed' } }; } }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sandbox`;
  const headers = { authorization: 'Bearer test', 'content-type': 'application/json' };
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers })).status, 200);
  const body = { action: 'provision', expected_version: 3, expected_case_version: 4, operation_id: 'retry' };
  for (const invalid of [{ ...body, request_id: 'other' }, { ...body, passed: true }, { ...body, expected_case_version: 0 }, { ...body, expected_version: 0 },
    { action: 'submit', ram: 4, expected_version: 3, expected_case_version: 4 }])
    assert.equal((await fetch(`${url}/commands`, { method: 'POST', headers, body: JSON.stringify(invalid) })).status, 400);
  assert.equal(calls.length, 1);
  assert.equal((await fetch(`${url}/commands`, { method: 'POST', headers, body: JSON.stringify(body) })).status, 200);
  assert.equal(calls[1][3].request_id, undefined);
  assert.equal(calls[1][3].operation_id, 'retry');
});

test('sandbox rejects nonboolean conditions and invalid opaque IDs before mutation', () => {
  for (const body of [
    { action: 'submit', ram: 4, request_id: 'x', expected_version: 1, account_active: 'true' },
    { action: 'image', request_id: 'x', image_id: 'image', available: 1, expected_version: 1 },
    { action: 'account', request_id: 'x', account_id: 'a\u0000', active: true, expected_version: 1 },
  ]) assert.throws(() => labCommand(body), e => e.status === 400);
});
