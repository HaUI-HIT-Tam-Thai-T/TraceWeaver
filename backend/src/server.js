// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { readConfig } from './config.js';
import { createApp } from './app.js';
import { createDatabase } from './core/data/database.js';
import { isDatabaseReady, loadMigrations } from './core/data/migrations.js';
import { createTokenVerifier, createIngestTokenVerifier } from './core/identity/token-verifier.js';
import { createCursorCodec } from './core/identity/cursor.js';
import { createAccessRepository } from './core/identity/access-repository.js';
import { createAccessService } from './services/access.service.js';
import { createIngestionRepository } from './core/data/ingestion-repository.js';
import { createIngestionService } from './services/ingestion.service.js';

let database;
try {
  const config = readConfig();
  const migrations = await loadMigrations(new URL('./core/data/migrations/', import.meta.url));
  database = createDatabase(config, () => console.error('DATABASE_IDLE_ERROR'));
  const app = createApp({
    checkReadiness: () => isDatabaseReady(database, migrations),
    verifyToken: createTokenVerifier(config),
    verifyIngestToken: createIngestTokenVerifier(config),
    access: createAccessService(createAccessRepository(database), createCursorCodec(config.cursorSecret)),
    ingestion: createIngestionService(createIngestionRepository(database)),
    logError: (event) => console.error(JSON.stringify(event)),
  });
  const server = app.listen(config.port, config.host, () => {
    console.log(`TraceWeaver backend listening on ${config.host}:${config.port}`);
  });
  server.on('error', async () => {
    console.error('HTTP_SERVER_FAILED');
    process.exitCode = 1;
    await database.end();
  });
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.error('SHUTDOWN_TIMEOUT');
      process.exit(1);
    }, config.shutdownTimeoutMs);
    deadline.unref();
    server.close(async () => {
      try { await database.end(); } catch { process.exitCode = 1; }
      clearTimeout(deadline);
    });
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  // Configuration errors are intentionally sanitized by readConfig.
  console.error(error.message.startsWith('DATABASE_URL') || error.message.startsWith('API_') ||
    error.message.startsWith('APP_ENV') || error.message.startsWith('DB_POOL_MAX') ||
    error.message.startsWith('SHUTDOWN_TIMEOUT_MS') || error.message.startsWith('OIDC') ||
    error.message.startsWith('CURSOR_SECRET') ? error.message : 'BACKEND_STARTUP_FAILED');
  process.exitCode = 1;
  if (database) await database.end();
}
