// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/core/data/database.js';
import { loadMigrations, migrate } from '../../src/core/data/migrations.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

test('batch ingestion PostgreSQL authorization, deduplication, provenance and atomic audit', async (t) => {
  const config = readConfig(), admin = createDatabase(config);
  t.after(() => admin.end());
  const name = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  console.log(`Ingestion integration database retained: ${name}`);
  const url = new URL(config.databaseUrl); url.pathname = `/${name}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href });
  t.after(() => pool.end());
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));
  await migrate(pool, migrations);
  assert.deepEqual(await migrate(pool, migrations), []);
  const workspace = randomUUID(), source = randomUUID(), group = randomUUID();
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES ($1,$2)', [workspace, 'Ingestion']);
  await pool.query('INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version) VALUES ($1,$2,$3,$4,$5,$6)', [source, workspace, 'intake', 'Intake', 'intake', 'intake-v1']);
  for (const [subject, role] of [['writer', 'ingest_service'], ['admin', 'admin'], ['group-writer', 'ingest_service']]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES ($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES ($1,$2,$3)', [workspace, subject, role]);
  }
  const grant = randomUUID();
  for (const subject of ['writer', 'admin']) await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,'ingest','test')`, [subject === 'writer' ? grant : randomUUID(), workspace, source, subject]);
  await pool.query('INSERT INTO core.groups(id,workspace_id,name) VALUES ($1,$2,$3)', [group, workspace, 'Writers']);
  await pool.query('INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES ($1,$2,$3)', [workspace, group, 'group-writer']);
  await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,'ingest','test')`, [randomUUID(), workspace, source, group]);
  const service = createIngestionService(createIngestionRepository(pool));
  const event = { source_event_id: 'one', occurred_at: '2026-10-19T03:00:00Z', service: 'intake', action: 'request.accepted', outcome: 'success', identifiers: [{ namespace: 'request', value: '42' }], message: 'password=hidden', payload: { access_token: 'hidden' } };
  const ingest = (events, subject = 'writer', wid = workspace, sid = source) => service.batch(subject, wid, sid, { events });
  const schema = JSON.parse(await readFile(new URL('../../contracts/schemas/domain.schema.json', import.meta.url), 'utf8'));
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const validate = ajv.getSchema(`${schema.$id}#/$defs/BatchResult`);

  await t.test('partial success, in-batch duplicate/conflict, canonical retry and redacted storage', async () => {
    const result = await ingest([event, event, { ...event, action: 'changed' }, null]);
    assert.equal(validate(result), true, JSON.stringify(validate.errors));
    assert.deepEqual([result.accepted, result.duplicate, result.rejected], [1, 1, 2]);
    assert.equal(result.results[2].code, 'SOURCE_EVENT_CONFLICT');
    const retry = await ingest([event]);
    assert.equal(retry.duplicate, 1);
    assert.equal(retry.results[0].event_id, result.results[0].event_id);
    const { rows: [row] } = await pool.query('SELECT * FROM core.events');
    assert.doesNotMatch(JSON.stringify(row), /hidden/);
    assert.equal(row.batch_id, result.batch_id);
    assert.equal(row.locator, 'line:1');
    assert.match(row.content_hash, /^[a-f0-9]{64}$/);
    assert.equal((await pool.query('SELECT * FROM core.audit_events')).rowCount, 2);
    await assert.rejects(pool.query('UPDATE core.events SET locator=$1', ['changed']), { code: '55000' });
  });
  await t.test('concurrent identical uploads create one event', async () => {
    const results = await Promise.all([ingest([{ ...event, source_event_id: 'concurrent' }]), ingest([{ ...event, source_event_id: 'concurrent' }])]);
    assert.equal(results.reduce((sum, row) => sum + row.accepted, 0), 1);
    assert.equal(results.reduce((sum, row) => sum + row.duplicate, 0), 1);
  });
  await t.test('scope, roles, group membership and revoked grants checked for every batch', async () => {
    await assert.rejects(ingest([event], 'unknown'), { status: 404 });
    await assert.rejects(ingest([event], 'admin'), { status: 403 });
    await assert.rejects(ingest([event], 'writer', randomUUID()), { status: 404 });
    await assert.rejects(ingest([event], 'writer', workspace, randomUUID()), { status: 404 });
    assert.equal((await ingest([event], 'group-writer')).duplicate, 1);
    await pool.query('DELETE FROM core.group_members WHERE group_id=$1', [group]);
    await assert.rejects(ingest([event], 'group-writer'), { status: 404 });
    await pool.query('UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE id=$1', [grant]);
    await assert.rejects(ingest([event]), { status: 404 });
    await pool.query('UPDATE core.source_grants SET revoked_at=NULL WHERE id=$1', [grant]);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='writer'`);
    await assert.rejects(ingest([event]), { status: 404 });
    await pool.query(`UPDATE core.memberships SET revoked_at=NULL WHERE subject='writer'`);
  });
  await t.test('audit failure rolls back events and batch together', async () => {
    const before = await pool.query('SELECT count(*)::int AS count FROM core.ingestion_batches');
    await pool.query(`CREATE FUNCTION core.fail_ingest_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit unavailable'; END; $$`);
    await pool.query(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON core.audit_events FOR EACH ROW EXECUTE FUNCTION core.fail_ingest_audit()`);
    await assert.rejects(ingest([{ ...event, source_event_id: 'rollback' }]), { status: 503 });
    assert.equal((await pool.query(`SELECT * FROM core.events WHERE source_event_id='rollback'`)).rowCount, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM core.ingestion_batches')).rows[0].count, before.rows[0].count);
  });
});
