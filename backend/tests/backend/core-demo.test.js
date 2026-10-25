// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { coreDemoTarget, coreClient, assertCoreClient, assertCoreAccount, configureCoreEnv } from '../../scripts/lib/core-demo.js';
test('core demo is restricted to development loopback traceweaver realm', () => {
  assert.equal(coreDemoTarget({}).issuer, 'http://localhost:8081/realms/traceweaver');
  assert.equal(coreDemoTarget({ OIDC_ISSUER: 'http://127.0.0.1:18081/realms/traceweaver' }).origin, 'http://127.0.0.1:18081');
  for (const env of [{ APP_ENV: 'test' }, { APP_ENV: 'production' }, { IDENTITY_PORT: '0' }, { CORE_APP_CLIENT_ID: 'traceweaver-web' },
    ...['https://remote.test/realms/traceweaver', 'http://localhost:8081/realms/master',
      'http://user:password@localhost:8081/realms/traceweaver', 'http://localhost:8081/realms/traceweaver?x=1'].map((OIDC_ISSUER) => ({ OIDC_ISSUER }))]) {
    assert.throws(() => coreDemoTarget(env));
  }
});
test('core client is confidential service-only with API audience and no browser origins', () => {
  const client = coreClient('private-local-secret'); assertCoreClient(client);
  assert.equal(client.secret, 'private-local-secret');
  for (const override of [{ publicClient: true }, { standardFlowEnabled: true }, { directAccessGrantsEnabled: true },
    { implicitFlowEnabled: true }, { serviceAccountsEnabled: false }, { fullScopeAllowed: true },
    { redirectUris: ['http://localhost/callback'] }, { webOrigins: ['*'] }, { protocolMappers: [] }]) {
    assert.throws(() => assertCoreClient({ ...client, ...override }));
  }
});
test('core env patches only empty/matching managed fields and preserves other bytes and line endings', () => {
  const original = '# local\r\nDATABASE_URL=private-db\r\nCORE_APP_SUBJECT=\r\nOTHER=value';
  const result = configureCoreEnv(original, 'service-sub');
  assert.equal(result, '# local\r\nDATABASE_URL=private-db\r\nCORE_APP_SUBJECT=service-sub\r\nOTHER=value\r\nCORE_APP_CLIENT_ID=traceweaver-core\r\n');
  assert.equal(configureCoreEnv(result, 'service-sub'), result);
  for (const text of ['CORE_APP_SUBJECT=other\n', 'CORE_APP_CLIENT_ID=other\n', 'CORE_APP_SUBJECT=\nCORE_APP_SUBJECT=\n']) {
    assert.throws(() => configureCoreEnv(text, 'service-sub'));
  }
  assert.throws(() => configureCoreEnv('', 'bad\nsub'));
});
test('service account response may omit client field but must match dedicated account and saved subject', () => {
  const account = { id: 'service-sub', username: 'service-account-traceweaver-core', enabled: true };
  assertCoreAccount(account, 'service-sub');
  for (const override of [{ enabled: false }, { username: 'someone-else' }, { serviceAccountClientId: 'other' }, { id: 'bad\nsubject' }]) {
    assert.throws(() => assertCoreAccount({ ...account, ...override }, 'service-sub'));
  }
  assert.throws(() => assertCoreAccount(account, 'old-service-sub'));
});
