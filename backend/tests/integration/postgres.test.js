import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { readConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import { createDatabase, withTransaction } from '../../src/core/data/database.js';
import { loadMigrations, migrate, isDatabaseReady } from '../../src/core/data/migrations.js';

test('PostgreSQL integration in an isolated database', async (t) => {
  const config = readConfig();
  const admin = createDatabase(config);
  t.after(() => admin.end());
  // Generated identifier only. Never drop or change the configured development DB.
  const name = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  console.log(`Integration database retained: ${name}`);
  const url = new URL(config.databaseUrl);
  url.pathname = `/${name}`;
  const database = createDatabase({ ...config, databaseUrl: url.href });
  t.after(() => database.end());
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));

  await t.test('pending schema is not ready; concurrent migration runners apply once', async () => {
    assert.equal(await isDatabaseReady(database, migrations), false);
    const results = await Promise.all([migrate(database, migrations), migrate(database, migrations)]);
    assert.equal(results.flat().length, migrations.length);
    assert.equal(await isDatabaseReady(database, migrations), true);
    assert.deepEqual(await migrate(database, migrations), []);
    const history = await database.query('SELECT name, checksum FROM public.traceweaver_schema_migrations ORDER BY name');
    assert.deepEqual(history.rows, migrations.map(({ name, checksum }) => ({ name, checksum })));
  });

  await t.test('a failed statement rolls back a preceding business write', async () => {
    const id = randomUUID();
    await assert.rejects(withTransaction(database, async (client) => {
      await client.query('INSERT INTO core.workspaces (id, name) VALUES ($1, $2)', [id, 'Rollback probe']);
      await client.query('SELECT 1 / 0');
    }), { code: '22012' });
    const result = await database.query('SELECT id FROM core.workspaces WHERE id = $1', [id]);
    assert.equal(result.rowCount, 0);
  });

  await t.test('failed SQL migration rolls back DDL and does not record history', async () => {
    const sql = 'CREATE TABLE core.rollback_probe (id integer); SELECT 1 / 0;';
    const failing = { name: '999_failure_probe.sql', sql, checksum: createHash('sha256').update(sql).digest('hex') };
    await assert.rejects(migrate(database, [...migrations, failing]), { code: '22012' });
    const table = await database.query("SELECT to_regclass('core.rollback_probe') AS probe");
    assert.equal(table.rows[0].probe, null);
    const history = await database.query('SELECT count(*)::int AS count FROM public.traceweaver_schema_migrations');
    assert.equal(history.rows[0].count, migrations.length);
  });

  await t.test('checksum drift is refused without changing the applied schema', async () => {
    const changed = migrations.map((migration, index) => index === 0 ? { ...migration, checksum: 'changed-checksum' } : migration);
    await assert.rejects(migrate(database, changed), /Migration history differs/);
    assert.equal(await isDatabaseReady(database, changed), false);
    assert.equal(await isDatabaseReady(database, migrations), true);
  });

  await t.test('HTTP readiness uses real DB connections and reports connection failures safely', async () => {
    const absentUrl = new URL(url);
    absentUrl.pathname = `/${name}_absent`;
    const absent = createDatabase({ ...config, databaseUrl: absentUrl.href });
    t.after(() => absent.end());
    let selected = database;
    const server = createApp({ checkReadiness: () => isDatabaseReady(selected, migrations) }).listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await once(server, 'listening');
    const address = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${address}/health/ready`)).status, 200);
    selected = absent;
    const response = await fetch(`${address}/health/ready`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'CORE_NOT_READY');
    assert.ok(!JSON.stringify(body).includes(name));
    assert.equal((await fetch(`${address}/health/live`)).status, 200);
  });
});
