// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/core/data/database.js';
import { migrate, loadMigrations } from '../../src/core/data/migrations.js';
import { createTokenVerifier } from '../../src/core/identity/token-verifier.js';
import { createAccessRepository } from '../../src/core/identity/access-repository.js';
import { createCursorCodec } from '../../src/core/identity/cursor.js';
import { createAccessService } from '../../src/services/access.service.js';
import { identitySimulation } from '../support/oidc-simulation.js';

test('authenticated read APIs enforce current PostgreSQL membership and source scope', async (t) => {
  const config = readConfig();
  const admin = createDatabase(config);
  t.after(() => admin.end());
  const dbName = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Identity integration database retained: ${dbName}`);
  const url = new URL(config.databaseUrl);
  url.pathname = `/${dbName}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href });
  t.after(() => pool.end());
  await migrate(pool, await loadMigrations(new URL('../../src/core/data/migrations/', import.meta.url)));
  const a = randomUUID(), b = randomUUID(), group = randomUUID();
  const ids = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  await pool.query('INSERT INTO core.workspaces (id,name) VALUES ($1,$2),($3,$4)', [a, 'Workspace A', b, 'Private B']);
  for (const [workspace, subject, role] of [[a, 'alice', 'viewer'], [a, 'admin', 'admin'], [a, 'service', 'ingest_service'], [b, 'bob', 'viewer']]) {
    await pool.query('INSERT INTO core.memberships (workspace_id,subject) VALUES ($1,$2)', [workspace, subject]);
    await pool.query('INSERT INTO core.membership_roles (workspace_id,subject,role_key) VALUES ($1,$2,$3)', [workspace, subject, role]);
  }
  await pool.query('INSERT INTO core.groups (id,workspace_id,name) VALUES ($1,$2,$3)', [group, a, 'Readers']);
  await pool.query('INSERT INTO core.group_members (workspace_id,group_id,subject) VALUES ($1,$2,$3)', [a, group, 'alice']);
  for (let i = 0; i < ids.length; i++) {
    await pool.query('INSERT INTO core.sources (id,workspace_id,source_key,name,service,parser_version) VALUES ($1,$2,$3,$4,$5,$6)', [ids[i], i === 4 ? b : a, `source_${i}`, `Source ${i}`, 'intake', 'intake-v1']);
  }
  for (const [source, subject, targetGroup, permission, workspace] of [[ids[0], 'alice', null, 'read', a], [ids[1], null, group, 'read', a], [ids[3], 'alice', null, 'ingest', a], [ids[4], 'bob', null, 'read', b]]) {
    await pool.query('INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), workspace, source, subject, targetGroup, permission, 'test-admin']);
  }
  for (const [id, workspace, version, title] of [[ids[0], a, 1, 'Old guide'], [ids[0], a, 2, 'Latest guide'], [ids[1], a, 1, 'Literal %_ guide'], [ids[4], b, 1, 'Private B guide']]) {
    await pool.query('INSERT INTO core.knowledge_articles (id,workspace_id,version,title,body,author_subject,source_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, workspace, version, title, 'Investigation procedure', 'test-admin', 'https://docs.example.test/guide']);
  }
  const sim = await identitySimulation(t);
  const server = createApp({
    checkReadiness: async () => true, verifyToken: createTokenVerifier(sim.config),
    access: createAccessService(createAccessRepository(pool), createCursorCodec(config.cursorSecret)),
  }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const alice = await sim.token({ roles: ['admin'], groups: ['forged'] });
  const api = async (path, token = alice) => {
    const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}`, 'X-Actor-Subject': 'bob' } : {} });
    return { res, body: await res.json() };
  };
  const schema = JSON.parse(await readFile(new URL('../../contracts/schemas/domain.schema.json', import.meta.url)));
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
  const conforms = (name, data) => {
    const validate = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
    assert.equal(validate(data), true, JSON.stringify(validate.errors));
  };

  await t.test('missing/expired/service-client tokens are 401 with standard challenge', async () => {
    for (const token of [null, 'not-a-jwt', await sim.token({ exp: 1 }), await sim.token({ azp: 'traceweaver-ingest' })]) {
      const { res, body } = await api('/me', token);
      assert.equal(res.status, 401); assert.match(res.headers.get('www-authenticate'), /Bearer/); conforms('Error', body);
    }
  });
  await t.test('/me uses database roles/groups, ignoring token and actor-header privilege claims', async () => {
    const { res, body } = await api('/me');
    assert.equal(res.status, 200); conforms('Me', body);
    assert.deepEqual(body, { subject: 'alice', memberships: [{ workspace_id: a, roles: ['viewer'], group_ids: [group] }] });
  });
  await t.test('sources only include direct/group read grants, with bound keyset cursor', async () => {
    const first = await api(`/workspaces/${a}/sources?limit=1`);
    assert.equal(first.res.status, 200); conforms('SourcesPage', first.body);
    assert.equal(first.body.items[0].id, ids[0]); assert.ok(first.body.next_cursor);
    const second = await api(`/workspaces/${a}/sources?limit=1&cursor=${encodeURIComponent(first.body.next_cursor)}`);
    assert.deepEqual(second.body.items.map((item) => item.id), [ids[1]]); assert.equal(second.body.next_cursor, null);
    const all = await api(`/workspaces/${a}/sources`);
    assert.deepEqual(all.body.items.map((item) => item.id), ids.slice(0, 2));
    const bob = await sim.token({ sub: 'bob' });
    assert.equal((await api(`/workspaces/${b}/sources?cursor=${encodeURIComponent(first.body.next_cursor)}`, bob)).res.status, 400);
  });
  await t.test('outside workspace is 404, reader role missing is 403, admin does not auto-read sources', async () => {
    assert.equal((await api(`/workspaces/${b}/sources`)).res.status, 404);
    assert.equal((await api(`/workspaces/${randomUUID()}/sources`)).res.status, 404);
    assert.equal((await api(`/workspaces/${a}/sources`, await sim.token({ sub: 'service' }))).res.status, 403);
    assert.deepEqual((await api(`/workspaces/${a}/sources`, await sim.token({ sub: 'admin' }))).body.items, []);
  });
  await t.test('knowledge selects latest versions, literal search and filter-bound cursors', async () => {
    const all = await api(`/workspaces/${a}/knowledge`); conforms('KnowledgePage', all.body);
    assert.deepEqual(all.body.items.map((item) => item.title), ['Latest guide', 'Literal %_ guide']);
    const searched = await api(`/workspaces/${a}/knowledge?q=${encodeURIComponent('%_')}`);
    assert.deepEqual(searched.body.items.map((item) => item.title), ['Literal %_ guide']);
    const first = await api(`/workspaces/${a}/knowledge?limit=1`);
    assert.equal((await api(`/workspaces/${a}/knowledge?q=guide&cursor=${encodeURIComponent(first.body.next_cursor)}`)).res.status, 400);
    assert.equal((await api(`/workspaces/${a}/sources?limit=101`)).res.status, 400);
    assert.equal((await api(`/workspaces/${a}/knowledge?limit=1&limit=2`)).res.status, 400);
  });
  await t.test('revocation changes scope immediately and invalidates old cursors without changing token', async () => {
    const first = await api(`/workspaces/${a}/sources?limit=1`);
    await pool.query('DELETE FROM core.group_members WHERE workspace_id=$1 AND group_id=$2 AND subject=$3', [a, group, 'alice']);
    assert.equal((await api(`/workspaces/${a}/sources?cursor=${encodeURIComponent(first.body.next_cursor)}`)).res.status, 400);
    assert.deepEqual((await api(`/workspaces/${a}/sources`)).body.items.map((item) => item.id), [ids[0]]);
    await pool.query('UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND grantee_subject=$2', [a, 'alice']);
    assert.deepEqual((await api(`/workspaces/${a}/sources`)).body.items, []);
    await pool.query('UPDATE core.memberships SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND subject=$2', [a, 'alice']);
    assert.equal((await api(`/workspaces/${a}/knowledge`)).res.status, 404);
    assert.deepEqual((await api('/me')).body.memberships, []);
  });
  await t.test('database connection failure returns sanitized 503 after authentication', async () => {
    const absentUrl = new URL(url);
    absentUrl.pathname = `/${dbName}_absent`;
    const absent = createDatabase({ ...config, databaseUrl: absentUrl.href });
    t.after(() => absent.end());
    const unavailable = createApp({ checkReadiness: async () => false, verifyToken: createTokenVerifier(sim.config),
      access: createAccessService(createAccessRepository(absent), createCursorCodec(config.cursorSecret)) }).listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve) => unavailable.close(resolve)));
    await once(unavailable, 'listening');
    const response = await fetch(`http://127.0.0.1:${unavailable.address().port}/api/v1/me`, { headers: { Authorization: `Bearer ${alice}` } });
    const body = await response.json();
    assert.equal(response.status, 503); conforms('Error', body);
    assert.ok(!JSON.stringify(body).includes(dbName));
  });
  await sim.waitForRequest();
});
