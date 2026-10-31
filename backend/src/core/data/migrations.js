// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { withTransaction } from './database.js';

export async function loadMigrations(directory) {
  const names = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  if (!names.length) throw new Error('No migrations found');
  const versions = names.map((name) => name.slice(0, 3));
  if (new Set(versions).size !== versions.length) throw new Error('Duplicate migration version');
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(new URL(name, directory), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

export function verifyAppliedMigrations(applied, migrations, requireAll = false) {
  const expected = new Map(migrations.map((migration) => [migration.name, migration.checksum]));
  for (const row of applied) {
    if (expected.get(row.name) !== row.checksum)
      throw new Error('Migration history differs from source');
  }
  if (requireAll && applied.length !== migrations.length)
    throw new Error('Database migrations are pending');
}

export async function migrate(pool, migrations) {
  return withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(742016, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.traceweaver_schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query(
      'SELECT name, checksum FROM public.traceweaver_schema_migrations ORDER BY name',
    );
    verifyAppliedMigrations(rows, migrations);
    const applied = new Set(rows.map((row) => row.name));
    const completed = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO public.traceweaver_schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum],
      );
      completed.push(migration.name);
    }
    return completed;
  });
}

export async function isDatabaseReady(pool, migrations) {
  try {
    const { rows } = await pool.query(
      'SELECT name, checksum FROM public.traceweaver_schema_migrations ORDER BY name',
    );
    verifyAppliedMigrations(rows, migrations, true);
    const result = await pool.query("SELECT to_regclass('core.workspaces') IS NOT NULL AS ready");
    return result.rows[0]?.ready === true;
  } catch {
    return false;
  }
}
