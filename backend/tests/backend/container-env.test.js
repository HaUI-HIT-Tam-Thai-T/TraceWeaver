// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
const script = new URL('../../scripts/container-env.js', import.meta.url).href;
const run = (env) => execFileSync(process.execPath, ['--import', script, '-e', 'process.stdout.write(process.env.DATABASE_URL)'], { env: { ...process.env, ...env }, encoding: 'utf8' });
test('container URL preserves escaped credentials and leaves explicit URLs unchanged', () => {
  const password = 'synthetic:p@ss%40/#?$', user = 'test%40user';
  const url = new URL(run({ DATABASE_URL: '', DATABASE_HOST: 'postgres', POSTGRES_DB: 'db/test', POSTGRES_USER: user, POSTGRES_PASSWORD: password }));
  assert.equal(url.hostname, 'postgres'); assert.equal(url.port, '5432');
  assert.equal(decodeURIComponent(url.username), user); assert.equal(decodeURIComponent(url.password), password);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), 'db/test');
  const explicit = 'postgresql://test:synthetic@external.example.test:5432/db';
  assert.equal(run({ DATABASE_URL: explicit }), explicit);
});
test('incomplete container DB config fails without echoing credentials', () => {
  const result = spawnSync(process.execPath, ['--import', script, '-e', ''], { env: { ...process.env, DATABASE_URL: '', DATABASE_HOST: '', POSTGRES_PASSWORD: 'synthetic-secret' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /configuration is incomplete/); assert.doesNotMatch(result.stderr, /synthetic-secret/);
});
