// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { readConfig } from './config.js';
import { createApp } from './app.js';
import { createDatabase } from './core/data/database.js';
import { isDatabaseReady, loadMigrations } from './core/data/migrations.js';
import { createTokenVerifier, createIngestTokenVerifier, createAppTokenVerifier } from './core/identity/token-verifier.js';
import { createCursorCodec } from './core/identity/cursor.js';
import { createAccessRepository } from './core/identity/access-repository.js';
import { createAccessService } from './services/access.service.js';
import { createIngestionRepository } from './core/data/ingestion-repository.js';
import { createIngestionService } from './services/ingestion.service.js';
import { createEventRepository } from './core/data/event-repository.js';
import { createEventService } from './services/event.service.js';
import { createEventCursorCodec } from './core/identity/event-cursor.js';
import { createScorer } from './core/reconstruction/scorer.js';
import { sandboxRulePolicy } from './core/reconstruction/policy.js';
import { createRunRepository } from './core/data/run-repository.js';
import { createRunService } from './services/run.service.js';
import { createReviewRepository } from './core/data/review-repository.js';
import { createReviewService } from './services/review.service.js';
import { createCaseRepository } from './core/data/case-repository.js';
import { createCaseService } from './services/case.service.js';
import { createDashboardRepository } from './core/data/dashboard-repository.js';
import { createDashboardService } from './services/dashboard.service.js';
import { createWorkflowRepository } from './core/data/workflow-repository.js';
import { createWorkflowService } from './services/workflow.service.js';
import { createLabRepository } from './core/data/lab-repository.js';
import { createLabCollector } from './core/data/lab-collector.js';
import { createAdminRepository } from './core/data/admin-repository.js';
import { createAdminService } from './services/admin.service.js';
import { createAccountProvider } from './core/identity/account-provider.js';

let database;
try {
  const config = readConfig();
  if (config.labIngestSubject && config.poolMax < 2) throw new Error('LAB_COLLECTOR requires DB_POOL_MAX at least 2');
  const migrations = await loadMigrations(new URL('./core/data/migrations/', import.meta.url));
  database = createDatabase(config, () => console.error('DATABASE_IDLE_ERROR'));
  const app = createApp({
    frontendOrigins: config.frontendOrigins,
    checkReadiness: () => isDatabaseReady(database, migrations),
    verifyToken: createTokenVerifier(config),
    verifyIngestToken: createIngestTokenVerifier(config),
    verifyAppToken: createAppTokenVerifier(config),
    workflows: createWorkflowService(createWorkflowRepository(database)),
    lab: createLabRepository(database),
    admin: createAdminService(createAdminRepository(database, {
      protectedSubjects: [config.oidcAppSubject, config.labIngestSubject],
    }), createAccountProvider(config), config.cursorSecret),
    oidc: { issuer: config.oidcIssuer, clientId: config.oidcUserClientId },
    access: createAccessService(createAccessRepository(database), createCursorCodec(config.cursorSecret)),
    ingestion: createIngestionService(createIngestionRepository(database)),
    events: createEventService(createEventRepository(database), createAccessRepository(database), createEventCursorCodec(config.cursorSecret)),
    runs: createRunService(createRunRepository(database, sandboxRulePolicy(), createScorer(config))),
    reviews: createReviewService(createReviewRepository(database)),
    cases: createCaseService(createCaseRepository(database), createAccessRepository(database), createCursorCodec(config.cursorSecret)),
    dashboard: createDashboardService(createDashboardRepository(database)),
    logError: (event) => console.error(JSON.stringify(event)),
  });
  let collectorTimer;
  if (config.labIngestSubject) {
    const collect = createLabCollector(database, createIngestionService(createIngestionRepository(database)), config.labIngestSubject);
    let collecting = false;
    collectorTimer = setInterval(async () => {
      if (collecting) return;
      collecting = true;
      try { await collect(); } catch { console.error('LAB_COLLECTOR_UNAVAILABLE'); }
      finally { collecting = false; }
    }, 2000);
    collectorTimer.unref();
  }
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
    clearInterval(collectorTimer);
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
    error.message.startsWith('CURSOR_SECRET') || error.message.startsWith('FRONTEND_') ? error.message : 'BACKEND_STARTUP_FAILED');
  process.exitCode = 1;
  if (database) await database.end();
}
