// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/core/data/database.js';
import { loadMigrations, migrate } from '../../src/core/data/migrations.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { createRunRepository } from '../../src/core/data/run-repository.js';
import { createReviewRepository } from '../../src/core/data/review-repository.js';
import { createCaseRepository } from '../../src/core/data/case-repository.js';

export async function caseFixture(t) {
  const config = readConfig(), admin = createDatabase(config); t.after(() => admin.end());
  const db = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${db}"`); console.log(`Case test database retained: ${db}`);
  const url = new URL(config.databaseUrl); url.pathname = `/${db}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href }); t.after(() => pool.end());
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));
  await migrate(pool, migrations.slice(0, 6));
  const workspace = randomUUID(), otherWorkspace = randomUUID(), sources = Array.from({ length: 3 }, randomUUID);
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES($1,\'Cases\'),($2,\'Other\')', [workspace, otherWorkspace]);
  for (const [subject, role] of [['operator', 'operator'], ['other', 'operator'], ['reviewer', 'reviewer'], ['viewer', 'viewer'], ['admin', 'admin'], ['writer', 'ingest_service']]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES($1,$2,$3)', [workspace, subject, role]);
    for (const [i, source] of sources.entries()) {
      const service = ['intake', 'account', 'provision'][i];
      await pool.query(`INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version)
        VALUES($1,$2,$3,$3,$4,$5) ON CONFLICT DO NOTHING`, [source, workspace, service, service, `${service}-v1`]);
      await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by)
        VALUES($1,$2,$3,$4,$5,'test')`, [randomUUID(), workspace, source, subject, subject === 'writer' ? 'ingest' : 'read']);
    }
  }
  const ingest = createIngestionService(createIngestionRepository(pool));
  const events = [];
  for (let i = 0; i < 3; i++) {
    const source = i === 1 ? 1 : 0;
    const result = await ingest.batch('writer', workspace, sources[source], { events: [{ source_event_id: `case-event-${i}`,
      occurred_at: `2026-10-23T00:00:0${i}Z`, service: source === 1 ? 'account' : 'intake',
      action: ['request.accepted', 'account.created', 'unrelated'][i], outcome: 'success',
      identifiers: i < 2 ? [{ namespace: 'request', value: 'R1' }] : [], message: 'observed', payload: {} }] });
    events.push(result.results[0].event_id);
  }
  const input = { root_event_id: events[0], source_ids: sources, mode: 'rule_only',
    window: { from: '2026-10-23T00:00:00Z', to: '2026-10-23T00:01:00Z' } };
  const runs = createRunRepository(pool), run = await runs.create('operator', workspace, input);
  await migrate(pool, migrations); await migrate(pool, migrations);
  return { config, pool, workspace, otherWorkspace, sources, events, input, run, runs,
    reviews: createReviewRepository(pool), cases: createCaseRepository(pool) };
}
