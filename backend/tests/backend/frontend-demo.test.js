// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { frontendClient } from '../../scripts/lib/frontend-demo.js';
test('frontend callbacks append exactly and idempotently without changing existing public client settings', () => {
  const client = { clientId: 'traceweaver-web', publicClient: true, standardFlowEnabled: true,
    directAccessGrantsEnabled: false, implicitFlowEnabled: false, webOrigins: ['http://localhost:8080'],
    redirectUris: ['http://localhost:8080/docs/oauth2-redirect.html'],
    attributes: { 'pkce.code.challenge.method': 'S256', other: 'keep' }, protocolMappers: [{ name: 'audience' }] };
  const updated = frontendClient(client, ['http://localhost:3000']);
  assert.deepEqual(updated.redirectUris, [...client.redirectUris, 'http://localhost:3000/auth/callback']);
  assert.deepEqual(updated.attributes, client.attributes); assert.deepEqual(updated.protocolMappers, client.protocolMappers);
  assert.deepEqual(frontendClient(updated, ['http://localhost:3000']), updated);
  assert.deepEqual(client.webOrigins, ['http://localhost:8080']);
  for (const patch of [{ clientId: 'traceweaver-core' }, { publicClient: false }, { directAccessGrantsEnabled: true },
    { attributes: {} }]) assert.throws(() => frontendClient({ ...client, ...patch }, []));
});
