// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { withTransaction } from '../../src/core/data/database.js';
import { isDatabaseReady, loadMigrations, migrate } from '../../src/core/data/migrations.js';

function fakePool({ rows = [], failSql } = {}) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === failSql) throw new Error('injected DB failure');
      return { rows: sql.startsWith('SELECT name') ? rows : [] };
    },
    release(error) { calls.push({ release: true, error }); },
  };
  return { connect: async () => client, calls };
}

test('business write failure rolls back and releases connection; commit never runs', async () => {
  const pool = fakePool();
  const error = new Error('audit insert failed');
  await assert.rejects(withTransaction(pool, async (client) => {
    await client.query('UPDATE business row');
    throw error;
  }), (actual) => actual === error);
  assert.deepEqual(pool.calls.map((call) => call.sql ?? 'release'), ['BEGIN', 'UPDATE business row', 'ROLLBACK', 'release']);
});

test('rollback failure discards connection and preserves original error', async () => {
  const pool = fakePool({ failSql: 'ROLLBACK' });
  const error = new Error('original failure');
  await assert.rejects(withTransaction(pool, async () => { throw error; }), (actual) => actual === error);
  assert.ok(pool.calls.at(-1).error instanceof Error);
});

test('migrations skip matching history but reject checksum drift before applying SQL', async () => {
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));
  assert.ok(migrations.length >= 1);
  const migration = migrations[0];
  assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  const applied = migrations.map(({ name, checksum }) => ({ name, checksum }));
  const existing = fakePool({ rows: applied });
  assert.deepEqual(await migrate(existing, migrations), []);
  assert.ok(!existing.calls.some((call) => call.sql === migration.sql));
  const drifted = fakePool({ rows: applied.map((row, index) => index === 0 ? { ...row, checksum: 'changed' } : row) });
  await assert.rejects(migrate(drifted, migrations), /history differs/);
  assert.ok(!drifted.calls.some((call) => call.sql === migration.sql));
  assert.ok(drifted.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('failed migration cannot record successful history or commit', async () => {
  const migrations = [{ name: '001_test.sql', checksum: 'checksum', sql: 'INVALID SQL' }];
  const pool = fakePool({ failSql: 'INVALID SQL' });
  await assert.rejects(migrate(pool, migrations), /injected DB failure/);
  assert.ok(!pool.calls.some((call) => call.sql?.startsWith('INSERT INTO')));
  assert.ok(!pool.calls.some((call) => call.sql === 'COMMIT'));
  assert.ok(pool.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('readiness fails for offline DB, absent migrations and changed history', async () => {
  const migrations = [{ name: '001_test.sql', checksum: 'expected' }];
  for (const query of [
    async () => { throw new Error('DB offline'); },
    async () => ({ rows: [] }),
    async () => ({ rows: [{ name: '001_test.sql', checksum: 'changed' }] }),
  ]) {
    assert.equal(await isDatabaseReady({ query }, migrations), false);
  }
});
