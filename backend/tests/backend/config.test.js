// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config.js';

const valid = { DATABASE_URL: 'postgresql://app:local-password@localhost:5432/traceweaver', CURSOR_SECRET: 'test-only-secret-with-at-least-32-characters' };

test('configuration validates defaults and explicit ports', () => {
  assert.equal(readConfig(valid).port, 8080);
  assert.equal(readConfig({ ...valid, API_PORT: '8090' }).port, 8090);
});

test('identity configuration rejects insecure production URLs and missing cursor key', () => {
  assert.throws(() => readConfig({ ...valid, CURSOR_SECRET: '' }), /CURSOR_SECRET/);
  assert.throws(() => readConfig({ ...valid, OIDC_ISSUER: 'http://untrusted.example.test/realm' }), /OIDC_ISSUER/);
  assert.throws(() => readConfig({ ...valid, APP_ENV: 'production' }), /OIDC_ISSUER/);
  assert.throws(() => readConfig({ ...valid, OIDC_JWKS_URI: 'http://localhost:8081/certs?secret=no' }), /OIDC_JWKS_URI/);
  assert.throws(() => readConfig({ ...valid, OIDC_API_AUDIENCE: '' }), /OIDC/);
  assert.throws(() => readConfig({ ...valid, INGEST_CLIENT_ID: '' }), /OIDC/);
  assert.throws(() => readConfig({ ...valid, INGEST_CLIENT_ID: 'traceweaver-web' }), /OIDC/);
  assert.equal(readConfig(valid).oidcJwksUri, 'http://localhost:8081/realms/traceweaver/protocol/openid-connect/certs');
});

test('configuration rejects empty credentials and malformed values without exposing secrets', () => {
  for (const databaseUrl of ['', 'mongodb://app:secret@localhost/db', 'postgresql://app@localhost/db']) {
    assert.throws(() => readConfig({ DATABASE_URL: databaseUrl }), /DATABASE_URL/);
  }
  for (const port of ['abc', '0', '65536', '80.5', '8080oops']) {
    assert.throws(() => readConfig({ ...valid, API_PORT: port }), /API_PORT/);
  }
  assert.throws(() => readConfig({ ...valid, APP_ENV: 'typo' }), /APP_ENV/);
  assert.throws(() => readConfig({ DATABASE_URL: 'private-secret' }), (error) => !error.message.includes('private-secret'));
});
