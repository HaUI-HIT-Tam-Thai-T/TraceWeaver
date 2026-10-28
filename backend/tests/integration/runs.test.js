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
import { createRunRepository } from '../../src/core/data/run-repository.js';
import { runInput } from '../../src/validations/run.validation.js';
import { digest } from '../../src/core/data/event-normalizer.js';
import { withTransaction } from '../../src/core/data/database.js';
import { createReviewRepository } from '../../src/core/data/review-repository.js';
import { manualLinkInput, reviewInput } from '../../src/validations/review.validation.js';

test('durable reconstruction: snapshot, idempotency, whole-artifact ACL and atomic audit on PostgreSQL', async (t) => {
  const config = readConfig(), admin = createDatabase(config); t.after(() => admin.end());
  const dbName = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${dbName}"`); console.log(`Run integration database retained: ${dbName}`);
  const url = new URL(config.databaseUrl); url.pathname = `/${dbName}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href }); t.after(() => pool.end());
  const migrations = await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url));
  await migrate(pool, migrations); assert.deepEqual(await migrate(pool, migrations), []);
  const workspace = randomUUID(), other = randomUUID(), group = randomUUID(), sources = Array.from({ length: 4 }, randomUUID);
  await pool.query('INSERT INTO core.workspaces(id,name) VALUES ($1,$2),($3,$4)', [workspace, 'Runs', other, 'Other']);
  for (const [subject, role] of [['operator', 'operator'], ['viewer', 'viewer'], ['reviewer', 'reviewer'], ['admin', 'admin'], ['writer', 'ingest_service']]) {
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES ($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES ($1,$2,$3)', [workspace, subject, role]);
  }
  await pool.query('INSERT INTO core.groups(id,workspace_id,name) VALUES ($1,$2,$3)', [group, workspace, 'Operators']);
  await pool.query(`INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES ($1,$2,'operator')`, [workspace, group]);
  for (const [index, source] of sources.entries()) {
    const service = ['intake', 'account', 'provision', 'intake'][index];
    await pool.query('INSERT INTO core.sources(id,workspace_id,source_key,name,service,parser_version) VALUES($1,$2,$3,$3,$4,$5)',
      [source, workspace, `source${index}`, service, `${service}-v1`]);
    await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by)
      VALUES($1,$2,$3,'writer','ingest','test')`, [randomUUID(), workspace, source]);
    for (const subject of ['viewer', 'reviewer', 'admin']) await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by)
      VALUES($1,$2,$3,$4,'read','test')`, [randomUUID(), workspace, source, subject]);
    await pool.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,group_id,permission,granted_by)
      VALUES($1,$2,$3,$4,'read','test')`, [randomUUID(), workspace, source, group]);
  }
  const ingestion = createIngestionService(createIngestionRepository(pool));
  let serial = 0;
  const ingest = (index, patch = {}) => ingestion.batch('writer', workspace, sources[index], { events: [{
    source_event_id: `run-observable-${++serial}`, occurred_at: `2026-10-22T00:00:0${index}Z`, service: ['intake', 'account', 'provision'][index],
    action: ['request.accepted', 'account.created', 'provision.failed'][index], outcome: index === 2 ? 'failed' : 'success',
    identifiers: [{ namespace: 'request', value: 'R1' }], message: 'password=hidden', payload: { token: 'hidden' }, ...patch,
  }] });
  const initial = await Promise.all([ingest(0), ingest(1), ingest(2)]);
  const root = initial[0].results[0].event_id, repository = createRunRepository(pool);
  const input = runInput({ root_event_id: root, source_ids: sources, mode: 'rule_only',
    window: { from: '2026-10-22T00:00:00Z', to: '2026-10-22T00:01:00Z' } });
  let run;
  await t.test('create persists exact snapshot, policy, pending links, graph and one audit; replay and concurrent retry are exact', async () => {
    run = await repository.create('operator', workspace, input, 'once');
    assert.equal(run.status, 'completed'); assert.equal(run.effective_method, 'rule_only'); assert.equal(run.degraded, false);
    assert.deepEqual(await repository.create('operator', workspace, input, 'once'), run);
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => repository.create('operator', workspace, input, 'concurrent')));
    assert.ok(concurrent.every((value) => value.id === concurrent[0].id));
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM core.audit_events WHERE action='reconstruction.created' AND entity_id=$1`, [run.id])).rows[0].n, 1);
    const graph = await repository.get('viewer', workspace, run.id, true);
    assert.equal(graph.nodes.length, 3); assert.equal(graph.links.length, 2); assert.deepEqual(graph.missing_expected_steps, []);
    assert.equal(graph.nodes.find((event) => event.service === 'provision').outcome, 'failed');
    assert.ok(graph.links.every((link) => link.method === 'rule' && link.review_state === 'pending'));
    assert.doesNotMatch(JSON.stringify(graph), /hidden|insert_xid|creator_subject/);
    assert.equal((await pool.query('SELECT policy->>\'version\' AS version FROM core.reconstruction_runs WHERE id=$1', [run.id])).rows[0].version, run.rule_version);
    await assert.rejects(repository.create('operator', workspace, { ...input, mode: 'hybrid' }, 'once'), { status: 409 });
    const another = await repository.create('reviewer', workspace, input, 'once'); assert.notEqual(another.id, run.id);
    assert.notEqual((await repository.create('operator', workspace, input)).id, (await repository.create('operator', workspace, input)).id);
  });
  await t.test('late events and another request do not alter snapshot or cached response; hybrid is honestly degraded', async () => {
    const before = await repository.get('viewer', workspace, run.id, true);
    await ingest(1, { identifiers: [{ namespace: 'request', value: 'unrelated' }] });
    assert.deepEqual(await repository.get('viewer', workspace, run.id, true), before);
    assert.deepEqual(await repository.create('operator', workspace, input, 'once'), run);
    const fresh = await repository.create('operator', workspace, { ...input, mode: 'hybrid' });
    assert.equal(fresh.mode, 'hybrid'); assert.equal(fresh.degraded, true); assert.equal(fresh.degraded_reason, 'ai_unavailable');
    assert.equal((await repository.get('viewer', workspace, fresh.id, true)).nodes.length, 4);
  });
  await t.test('expiry permits a new run without changing old artifact; snapshot tables and root membership are constrained', async () => {
    await pool.query(`UPDATE core.run_idempotency SET expires_at=clock_timestamp()-interval '1 second' WHERE run_id=$1`, [run.id]);
    assert.notEqual((await repository.create('operator', workspace, input, 'once')).id, run.id);
    for (const table of ['reconstruction_runs', 'run_sources', 'run_events', 'run_links']) {
      await assert.rejects(pool.query(`DELETE FROM core.${table}`), { code: '55000' });
    }
    await assert.rejects(repository.get('operator', other, run.id), { status: 404 });
    await assert.rejects(repository.create('operator', workspace, { ...input, root_event_id: randomUUID() }), { status: 404 });
    await assert.rejects(repository.create('viewer', workspace, input), { status: 403 });
    await assert.rejects(repository.create('admin', workspace, input), { status: 403 });
    await assert.rejects(repository.create('writer', workspace, input), { status: 403 });
  });
  await t.test('revoking even an empty source denies the entire old artifact/replay; grants, groups and membership are current', async () => {
    await pool.query('UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE group_id=$1 AND source_id=$2', [group, sources[3]]);
    for (const graph of [false, true]) await assert.rejects(repository.get('operator', workspace, run.id, graph), { status: 404 });
    await assert.rejects(repository.create('operator', workspace, input, 'concurrent'), { status: 404 });
    await pool.query('UPDATE core.source_grants SET revoked_at=NULL WHERE group_id=$1', [group]);
    await pool.query('DELETE FROM core.group_members WHERE group_id=$1', [group]);
    await assert.rejects(repository.get('operator', workspace, run.id), { status: 404 });
    await pool.query(`INSERT INTO core.group_members(workspace_id,group_id,subject) VALUES($1,$2,'operator')`, [workspace, group]);
    await pool.query(`UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE subject='operator'`);
    await assert.rejects(repository.get('operator', workspace, run.id), { status: 404 });
    await pool.query(`UPDATE core.memberships SET revoked_at=NULL WHERE subject='operator'`);
  });
  await t.test('fractional bounds are rounded outward correctly for PostgreSQL microseconds, not nearest', async () => {
    const limited = { ...input, window: { from: '2026-10-22T00:00:00.0000001Z', to: input.window.to } };
    await assert.rejects(repository.create('operator', workspace, limited), { status: 404 });
    const end = { ...input, window: { from: input.window.from, to: '2026-10-22T00:00:00.9999999Z' } };
    const short = await repository.create('operator', workspace, end);
    assert.equal((await repository.get('viewer', workspace, short.id, true)).nodes.length, 1);
  });
  await t.test('an open insert that commits after snapshot stays out; pending graph returns409 and snapshot FKs reject mismatched sources', async () => {
    const pending = await pool.connect(), pendingId = randomUUID();
    try {
      await pending.query('BEGIN');
      const { rows: [base] } = await pool.query('SELECT * FROM core.events WHERE event_id=$1', [root]);
      const document = { ...base.document, source_event_id: 'pending-reconstruction', identifiers: [] };
      await pending.query(`INSERT INTO core.events(event_id,workspace_id,source_id,source_event_id,occurred_at,content_hash,document,batch_id,locator)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'line:pending')`, [pendingId, workspace, sources[0], document.source_event_id,
        document.occurred_at, digest(document), document, base.batch_id]);
      const snapshot = await repository.create('operator', workspace, input);
      await pending.query('COMMIT');
      const graph = await repository.get('viewer', workspace, snapshot.id, true);
      assert.ok(!graph.nodes.some((event) => event.event_id === pendingId));
      const fresh = await repository.create('operator', workspace, input);
      assert.ok((await repository.get('viewer', workspace, fresh.id, true)).nodes.some((event) => event.event_id === pendingId));
      await assert.rejects(pool.query(`INSERT INTO core.run_events(workspace_id,run_id,source_id,event_id) VALUES($1,$2,$3,$4)`,
        [workspace, snapshot.id, sources[1], pendingId]), { code: '23503' });
      const queuedId = randomUUID();
      await withTransaction(pool, async (client) => {
        await client.query(`INSERT INTO core.reconstruction_runs(id,workspace_id,creator_subject,root_event_id,input_snapshot_id,request,policy,document,graph_metadata)
          SELECT $2::uuid,workspace_id,creator_subject,root_event_id,$3::uuid,request,policy,
          document||jsonb_build_object('id',$2::uuid::text,'input_snapshot_id',$3::uuid::text,'status','queued','completed_at',NULL),graph_metadata
          FROM core.reconstruction_runs WHERE id=$1`, [snapshot.id, queuedId, randomUUID()]);
        await client.query(`INSERT INTO core.run_sources SELECT workspace_id,$2,source_id FROM core.run_sources WHERE run_id=$1`, [snapshot.id, queuedId]);
        await client.query(`INSERT INTO core.run_events SELECT workspace_id,$2,source_id,event_id FROM core.run_events WHERE run_id=$1`, [snapshot.id, queuedId]);
      });
      assert.equal((await repository.get('viewer', workspace, queuedId)).status, 'queued');
      await assert.rejects(repository.get('viewer', workspace, queuedId, true), { status: 409, code: 'RUN_NOT_READY' });
    } finally { await pending.query('ROLLBACK'); pending.release(); }
  });
  await t.test('audit failure rolls back run, snapshot, links and idempotency together', async () => {
    const count = (table) => pool.query(`SELECT count(*)::int AS n FROM core.${table}`).then(({ rows }) => rows[0].n);
    const tables = ['reconstruction_runs', 'run_events', 'run_sources', 'run_links', 'run_idempotency'];
    const before = await Promise.all(tables.map(count));
    await pool.query(`CREATE FUNCTION core.fail_run_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-test-audit-error'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_run_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action='reconstruction.created') EXECUTE FUNCTION core.fail_run_audit()`);
    await assert.rejects(repository.create('operator', workspace, input, 'rollback'));
    assert.deepEqual(await Promise.all(tables.map(count)), before);
    await pool.query('DROP TRIGGER fail_run_audit ON core.audit_events');
    assert.equal((await repository.create('operator', workspace, input, 'rollback')).status, 'completed');
  });
  await t.test('append-only reviews preserve baseline, increment graph/link versions and serialize stale concurrent decisions', async () => {
    const fresh = await repository.create('operator', workspace, input), reviews = createReviewRepository(pool);
    const graph = await repository.get('operator', workspace, fresh.id, true), link = graph.links[0];
    const decisions = await Promise.allSettled(['accepted', 'rejected'].map((decision) => reviews.review('operator', workspace, fresh.id, link.id,
      reviewInput({ decision, reason: 'token=private-reason', expected_version: 1 }))));
    assert.equal(decisions.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(decisions.find((item) => item.status === 'rejected').reason.code, 'VERSION_CONFLICT');
    const review = decisions.find((item) => item.status === 'fulfilled').value;
    assert.equal(review.link_version, 2); assert.equal(review.actor_subject, 'operator'); assert.equal(review.reason, 'token=[REDACTED]');
    const updated = await repository.get('viewer', workspace, fresh.id, true);
    assert.equal(updated.version, 2); assert.equal(updated.links.find((item) => item.id === link.id).version, 2);
    assert.deepEqual((await pool.query('SELECT document FROM core.run_links WHERE id=$1', [link.id])).rows[0].document, link);
    await reviews.review('reviewer', workspace, fresh.id, link.id, { decision: 'rejected', reason: 'disconnect', expected_version: 2 });
    const disconnected = await repository.get('viewer', workspace, fresh.id, true);
    assert.equal(disconnected.version, 3); assert.ok(disconnected.unresolved_event_ids.length > graph.unresolved_event_ids.length);
    for (const verb of ['UPDATE core.link_reviews SET reason=reason', 'DELETE FROM core.link_reviews', 'TRUNCATE core.link_reviews']) {
      await assert.rejects(pool.query(verb), { code: '55000' });
    }
    await assert.rejects(pool.query(`INSERT INTO core.link_reviews(id,workspace_id,run_id,link_id,link_version,decision,reason,actor_subject)
      VALUES($1,$2,$3,$4,9,'accepted','bad scope','operator')`, [randomUUID(), workspace, run.id, link.id]), { code: '23503' });
  });
  await t.test('manual proposals enforce snapshot membership, duplicates and cycles, including reaccepting a rejected edge', async () => {
    const fresh = await repository.create('operator', workspace, input), reviews = createReviewRepository(pool);
    const graph = await repository.get('operator', workspace, fresh.id, true);
    const a = initial[0].results[0].event_id, b = initial[1].results[0].event_id, c = initial[2].results[0].event_id;
    const first = graph.links.find((link) => link.from_event_id === a && link.to_event_id === b);
    const create = (from, to) => reviews.manual('operator', workspace, fresh.id, manualLinkInput({ from_event_id: from, to_event_id: to, reason: 'observed manually' }));
    await assert.rejects(create(c, a), { status: 422, code: 'LINK_CYCLE' });
    await assert.rejects(create(a, b), { status: 409, code: 'LINK_EXISTS' });
    await assert.rejects(create(a, randomUUID()), { status: 404 });
    await reviews.review('operator', workspace, fresh.id, first.id, { decision: 'rejected', reason: 'wrong pair', expected_version: 1 });
    const reverse = await create(c, a);
    assert.equal(reverse.method, 'manual'); assert.equal(reverse.score, null); assert.equal(reverse.review_state, 'pending');
    await assert.rejects(reviews.review('operator', workspace, fresh.id, first.id,
      { decision: 'accepted', reason: 'retry', expected_version: 2 }), { status: 422, code: 'LINK_CYCLE' });
    await assert.rejects(create(c, a), { status: 409 });
    const updated = await repository.get('viewer', workspace, fresh.id, true);
    assert.equal(updated.version, 3); assert.equal(updated.links.length, graph.links.length + 1);
    const isolated = await repository.create('operator', workspace, { ...input,
      window: { from: input.window.from, to: '2026-10-22T00:00:00Z' } });
    await assert.rejects(reviews.manual('operator', workspace, isolated.id, { from_event_id: a, to_event_id: c, reason: 'outside snapshot' }), { status: 404 });
    await assert.rejects(reviews.review('operator', workspace, isolated.id, first.id, { decision: 'accepted', reason: 'other run', expected_version: 2 }), { status: 404 });
  });
  await t.test('concurrent opposing manual edges cannot both commit; whole-source ACL and atomic audit cover graph mutations', async () => {
    const fresh = await repository.create('operator', workspace, input), reviews = createReviewRepository(pool);
    const graph = await repository.get('operator', workspace, fresh.id, true), a = initial[0].results[0].event_id;
    const isolated = graph.nodes.find((event) => event.identifiers.length === 0).event_id;
    const race = await Promise.allSettled([[a, isolated], [isolated, a]].map(([from_event_id, to_event_id]) =>
      reviews.manual('operator', workspace, fresh.id, { from_event_id, to_event_id, reason: 'race' })));
    assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(race.find((item) => item.status === 'rejected').reason.code, 'LINK_CYCLE');
    const link = graph.links[0];
    for (const subject of ['viewer', 'admin', 'writer']) await assert.rejects(reviews.review(subject, workspace, fresh.id, link.id,
      { decision: 'accepted', reason: 'forbidden', expected_version: 1 }), { status: 403 });
    await pool.query('UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE group_id=$1 AND source_id=$2', [group, sources[3]]);
    await assert.rejects(reviews.review('operator', workspace, fresh.id, link.id,
      { decision: 'accepted', reason: 'revoked empty source', expected_version: 1 }), { status: 404 });
    await pool.query('UPDATE core.source_grants SET revoked_at=NULL WHERE group_id=$1', [group]);
    const before = await repository.get('operator', workspace, fresh.id, true);
    await pool.query(`CREATE FUNCTION core.fail_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-review-error'; END; $$`);
    await pool.query(`CREATE TRIGGER fail_link_audit BEFORE INSERT ON core.audit_events FOR EACH ROW WHEN(NEW.action IN ('link.reviewed','link.manual_created')) EXECUTE FUNCTION core.fail_link_audit()`);
    await assert.rejects(reviews.review('operator', workspace, fresh.id, link.id,
      { decision: 'accepted', reason: 'rollback', expected_version: 1 }));
    await assert.rejects(reviews.manual('operator', workspace, fresh.id,
      { from_event_id: a, to_event_id: initial[2].results[0].event_id, reason: 'rollback manual' }));
    assert.deepEqual(await repository.get('operator', workspace, fresh.id, true), before);
    await pool.query('DROP TRIGGER fail_link_audit ON core.audit_events');
    const recovered = await reviews.review('reviewer', workspace, fresh.id, link.id,
      { decision: 'accepted', reason: 'recovered', expected_version: 1 });
    assert.equal(recovered.link_version, 2);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM core.audit_events WHERE action='link.reviewed' AND entity_id=$1`, [link.id])).rows[0].n, 1);
  });
  await t.test('1001 events are rejected before filtering unrelated actions and do not leave a run', async () => {
    const { rows: [base] } = await pool.query('SELECT * FROM core.events WHERE event_id=$1', [root]);
    await pool.query(`INSERT INTO core.events(event_id,workspace_id,source_id,source_event_id,occurred_at,content_hash,document,batch_id,locator)
      SELECT gen_random_uuid(),$1,$2,'limit-'||n,$3,$4,
      $5::jsonb||jsonb_build_object('source_event_id','limit-'||n,'action','unrelated'),$6,'line:'||n
      FROM generate_series(1,1001) n`, [workspace, sources[0], base.occurred_at, base.content_hash, base.document, base.batch_id]);
    const before = (await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs')).rows[0].n;
    await assert.rejects(repository.create('operator', workspace, input, 'over-limit'), { status: 422, code: 'WINDOW_TOO_LARGE' });
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM core.reconstruction_runs')).rows[0].n, before);
  });
});
