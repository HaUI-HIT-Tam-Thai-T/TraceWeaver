// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/core/data/database.js';
import { loadMigrations, migrate } from '../../src/core/data/migrations.js';
import { createAccessRepository } from '../../src/core/identity/access-repository.js';
import { createTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createEventCursorCodec } from '../../src/core/identity/event-cursor.js';
import { createEventRepository } from '../../src/core/data/event-repository.js';
import { createEventService } from '../../src/services/event.service.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { normalizeEvent, digest } from '../../src/core/data/event-normalizer.js';
import { identitySimulation } from '../support/oidc-simulation.js';

test('event reads: JWT, current source ACL, provenance and commit-stable pagination on PostgreSQL', async (t) => {
  const config = readConfig(), admin = createDatabase(config); t.after(() => admin.end());
  const dbName = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Event read integration database retained: ${dbName}`);
  const url = new URL(config.databaseUrl); url.pathname = `/${dbName}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href }); t.after(() => pool.end());
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));
  await migrate(pool, migrations.slice(0, 3));
  const workspace = randomUUID(), otherWorkspace = randomUUID(), sources = [randomUUID(), randomUUID(), randomUUID()], group = randomUUID();
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES ($1,$2),($3,$4)', [workspace, 'Read events', otherWorkspace, 'Other']);
  for (const [subject, role] of [['alice', 'viewer'], ['bob', 'reviewer'], ['admin', 'admin'], ['writer', 'ingest_service']]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES ($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES ($1,$2,$3)', [workspace, subject, role]);
  }
  await pool.query('INSERT INTO core.groups(id,workspace_id,name) VALUES ($1,$2,$3)', [group, workspace, 'Readers']);
  await pool.query(`INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES ($1,$2,'alice')`, [workspace, group]);
  for (const [index, source] of sources.entries()) {
    await pool.query(`INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version) VALUES ($1,$2,$3,$3,'intake','intake-v1')`, [source, workspace, `source_${index}`]);
    await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,'writer','ingest','test')`, [randomUUID(), workspace, source]);
  }
  for (const subject of ['alice', 'bob']) await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,'read','test')`, [randomUUID(), workspace, sources[0], subject]);
  await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,'read','test')`, [randomUUID(), workspace, sources[1], group]);
  // Ingest grants never make events readable.
  await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,'alice','ingest','test')`, [randomUUID(), workspace, sources[2]]);
  const input = (id, time, patch = {}) => ({ source_event_id: id, occurred_at: `2026-10-19T03:${time}Z`, service: 'intake', action: 'request.accepted', outcome: 'success', identifiers: [{ namespace: 'request', value: 'R42' }], message: 'safe token=hidden', payload: { password: 'hidden' }, ...patch });
  const ingestion = createIngestionService(createIngestionRepository(pool));
  const ingest = (source, records) => ingestion.batch('writer', workspace, source, { events: records });
  const a = await ingest(sources[0], [input('one', '00:00'), input('two', '00:00', { message: 'literal %_ \\ marker', action: 'request.failed' })]);
  const b = await ingest(sources[1], [input('three', '01:00'), input('four', '02:00')]);
  const hidden = await ingest(sources[2], [input('private', '00:00', { message: 'privateonly' })]);
  const before = (await pool.query('SELECT event_id,content_hash,document FROM core.events ORDER BY event_id')).rows;
  await migrate(pool, migrations);
  assert.deepEqual((await pool.query('SELECT event_id,content_hash,document FROM core.events ORDER BY event_id')).rows, before);
  assert.deepEqual(await migrate(pool, migrations), []);
  const sim = await identitySimulation(t);
  const events = createEventService(createEventRepository(pool), createAccessRepository(pool), createEventCursorCodec(config.cursorSecret));
  const server = createApp({ checkReadiness: async () => true, verifyToken: createTokenVerifier(sim.config), access: {}, events }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${workspace}/events`, token = await sim.token();
  const get = async (suffix = '', bearer = token, root = base) => {
    const response = await fetch(root + suffix, { headers: bearer ? { Authorization: `Bearer ${bearer}`, 'X-Actor-Subject': 'admin' } : {} });
    return { status: response.status, body: await response.json() };
  };
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const conforms = (name, value) => { const validate = ajv.getSchema(`${schema.$id}#/$defs/${name}`); assert.equal(validate(value), true, JSON.stringify(validate.errors)); };
  const expected = [...a.results, ...b.results].map((row) => row.event_id);

  await t.test('read scope applies to lists, search and detail; response conforms with redacted provenance', async () => {
    const all = await get(); assert.equal(all.status, 200); conforms('EventsPage', all.body);
    assert.deepEqual(new Set(all.body.items.map((e) => e.event_id)), new Set(expected));
    assert.doesNotMatch(JSON.stringify(all.body), /hidden|privateonly|insert_xid|content_hash/);
    const detail = await get(`/${expected[0]}`); assert.equal(detail.status, 200); conforms('Event', detail.body);
    assert.equal(detail.body.provenance.batch_id, a.batch_id); assert.equal(detail.body.provenance.locator, 'line:1');
    assert.match(detail.body.provenance.sha256_redacted, /^[a-f0-9]{64}$/);
    const { event_id, source_id, received_at, provenance, ...content } = detail.body;
    assert.equal(digest(content), provenance.sha256_redacted);
    assert.equal((await get(`/${hidden.results[0].event_id}`)).status, 404);
    assert.equal((await get(`/${randomUUID()}`)).status, 404);
    assert.equal((await get(`?source_id=${sources[2]}`)).status, 404);
    assert.deepEqual((await get('?q=privateonly')).body.items, []);
  });
  await t.test('time/action/source filters and literal text/identifier search compose', async () => {
    assert.equal((await get(`?source_id=${sources[0]}`)).body.items.length, 2);
    assert.equal((await get('?from=2026-10-19T03:01:00Z&to=2026-10-19T03:01:00Z')).body.items.length, 1);
    assert.equal((await get('?action=request.failed')).body.items.length, 1);
    assert.equal((await get(`?q=${encodeURIComponent('%_ \\')}`)).body.items.length, 1);
    assert.equal((await get('?q=r42')).body.items.length, 4);
    assert.deepEqual((await get('?action=request.failed&q=does-not-exist')).body.items, []);
  });
  await t.test('fixed snapshot excludes later inserts and transactions open before page one, even after commit', async () => {
    const pending = await pool.connect();
    try {
      await pending.query('BEGIN'); await pending.query('SAVEPOINT before_event');
      const record = normalizeEvent(input('pending', '01:30'), { service: 'intake', parser_version: 'intake-v1' });
      const batch = randomUUID(), event = randomUUID();
      await pending.query(`INSERT INTO core.ingestion_batches(id,workspace_id,source_id,creator_subject,digest) VALUES ($1,$2,$3,'writer',$4)`, [batch, workspace, sources[0], record.hash]);
      await pending.query(`INSERT INTO core.events(event_id,workspace_id,source_id,source_event_id,occurred_at,content_hash,document,batch_id,locator) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,'line:1')`, [event, workspace, sources[0], record.event.occurred_at, record.hash, record.event, batch]);
      const top = (await pending.query('SELECT pg_current_xact_id()::text AS id')).rows[0].id;
      assert.equal((await pending.query('SELECT insert_xid::text AS id FROM core.events WHERE event_id=$1', [event])).rows[0].id, top);
      const first = await get('?limit=1'); assert.equal(first.status, 200); assert.ok(first.body.next_cursor);
      await pending.query('RELEASE SAVEPOINT before_event'); await pending.query('COMMIT');
      await ingest(sources[0], [input('late', '03:00')]);
      let page = first.body, ids = [];
      while (true) {
        conforms('EventsPage', page); ids.push(...page.items.map((e) => e.event_id));
        if (!page.next_cursor) break;
        const next = await get(`?limit=1&cursor=${encodeURIComponent(page.next_cursor)}`); assert.equal(next.status, 200); page = next.body;
        assert.ok(ids.length <= 4);
      }
      assert.equal(ids.length, 4); assert.equal(new Set(ids).size, 4); assert.deepEqual(new Set(ids), new Set(expected));
      const fresh = (await get()).body.items; assert.equal(fresh.length, 6);
      const order = fresh.map((e) => `${e.occurred_at}/${e.event_id}`); assert.deepEqual(order, [...order].sort());
    } finally { await pending.query('ROLLBACK'); pending.release(); }
  });
  await t.test('cursor tampering and changes to caller, workspace, filter, limit or current grants are rejected', async () => {
    const first = await get('?limit=1'), cursor = encodeURIComponent(first.body.next_cursor);
    for (const suffix of [`?limit=1&cursor=${cursor}!`, `?limit=2&cursor=${cursor}`, `?limit=1&q=r42&cursor=${cursor}`, `?limit=1&action=request.failed&cursor=${cursor}`]) assert.equal((await get(suffix)).status, 400);
    assert.equal((await get(`?limit=1&cursor=${cursor}`, await sim.token({ sub: 'bob' }))).status, 400);
    await pool.query(`INSERT INTO core.memberships(workspace_id,subject) VALUES ($1,'alice')`, [otherWorkspace]);
    await pool.query(`INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES ($1,'alice','viewer')`, [otherWorkspace]);
    assert.equal((await get(`?limit=1&cursor=${cursor}`, token, base.replace(workspace, otherWorkspace))).status, 400);
    await pool.query('DELETE FROM core.group_members WHERE group_id=$1', [group]);
    assert.equal((await get(`?limit=1&cursor=${cursor}`)).status, 400);
    assert.equal((await get(`/${b.results[0].event_id}`)).status, 404);
    assert.equal((await get()).body.items.length, 4);
    await pool.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='alice' AND permission='read'`);
    assert.deepEqual((await get()).body.items, []);
    assert.equal((await get(`/${expected[0]}`)).status, 404);
  });
  await t.test('authentication, roles, malformed IDs/query and revoked membership fail safely', async () => {
    for (const bearer of [null, 'bad', await sim.token({ azp: 'traceweaver-ingest' })]) assert.equal((await get('', bearer)).status, 401);
    assert.equal((await get('', await sim.token({ sub: 'writer' }))).status, 403);
    assert.deepEqual((await get('', await sim.token({ sub: 'admin' }))).body.items, []);
    for (const suffix of ['/bad', '?from=bad', '?q=a&q=b', '?limit=101', '?actor=admin', `/${expected[0]}?q=bad`]) assert.equal((await get(suffix)).status, 400);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND subject='alice'`, [workspace]);
    assert.equal((await get()).status, 404);
  });
  await t.test('database errors return sanitized 503 rather than internal SQL/connection data', async () => {
    const missing = new URL(url); missing.pathname = `/${dbName}_missing`;
    const absent = createDatabase({ ...config, databaseUrl: missing.href }); t.after(() => absent.end());
    const failed = createEventService(createEventRepository(absent), createAccessRepository(absent), createEventCursorCodec(config.cursorSecret));
    await assert.rejects(failed.detail('alice', workspace, expected[0]), (error) => error.status === 503 && !error.message.includes(dbName));
    const unavailable = createApp({ checkReadiness: async () => false, verifyToken: createTokenVerifier(sim.config), access: {}, events: failed }).listen(0, '127.0.0.1');
    await once(unavailable, 'listening'); t.after(() => new Promise((resolve) => unavailable.close(resolve)));
    const root = `http://127.0.0.1:${unavailable.address().port}/api/v1/workspaces/${workspace}/events`;
    for (const suffix of ['', `/${expected[0]}`]) {
      const response = await get(suffix, token, root); assert.equal(response.status, 503); conforms('Error', response.body);
      assert.doesNotMatch(JSON.stringify(response.body), new RegExp(dbName));
    }
  });
  await sim.waitForRequest();
});
