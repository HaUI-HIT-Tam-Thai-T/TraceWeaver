// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { readConfig } from '../src/config.js';
import { createDatabase } from '../src/core/data/database.js';
import { loadMigrations, migrate } from '../src/core/data/migrations.js';

let database;
try {
  const config = readConfig();
  database = createDatabase(config, () => console.error('DATABASE_IDLE_ERROR'));
  const migrations = await loadMigrations(new URL('../src/core/data/migrations/', import.meta.url));
  const applied = await migrate(database, migrations);
  console.log(
    applied.length ? `Applied: ${applied.join(', ')}` : 'Database migrations are up to date',
  );
} catch {
  console.error(
    'MIGRATION_FAILED: check database availability, credentials, permissions and migration history',
  );
  process.exitCode = 1;
} finally {
  if (database) await database.end();
}
