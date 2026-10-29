// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { caseFixture } from '../support/case-fixture.js';
import { createAdminRepository } from '../../src/core/data/admin-repository.js';
import { createAdminService } from '../../src/services/admin.service.js';
import { createAccessRepository } from '../../src/core/identity/access-repository.js';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { createWorkflowRepository } from '../../src/core/data/workflow-repository.js';

test('human admin API preserves configured core and collector identities without data roles', async t => {
  const { pool, workspace: wid, sources } = await caseFixture(t);
  const protectedSubjects = ['core-service', 'collector-service', 'unattached-service'];
  const repo = createAdminRepository(pool, { protectedSubjects });
  for (const subject of protectedSubjects.slice(0, 2))
    await pool.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2)', [wid, subject]);
  const workflows = createWorkflowRepository(pool);
  const document = await workflows.create('core-service', 'operator', wid, {
    definition_key: 'document_review', definition_version: 1, entity_ref: { type: 'document', id: randomUUID() },
  });
  let providerCalls = 0;
  const service = createAdminService(repo, { existing: async () => { providerCalls++; throw Error('provider offline'); } }, 'test-secret');
  const server = createApp({ verifyToken: async () => ({ subject: 'admin' }), access: {}, admin: service }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/workspaces/${wid}/admin/members`;
  for (const subject of protectedSubjects.slice(0, 2)) {
    for (const [path, body] of [[subject, { active: false, roles: ['viewer'], expected_version: 1 }],
      [`${subject}/sources/${sources[0]}`, { enabled: false, expected_version: 1 }]]) {
      const response = await fetch(`${base}/${path}`, { method: 'PUT', headers: { authorization: 'Bearer test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, 'SERVICE_ACCOUNT_PROTECTED');
    }
    await assert.rejects(repo.member('admin', wid, subject, { active: true, roles: ['admin'], expected_version: 1 }), e => e.code === 'SERVICE_ACCOUNT_PROTECTED');
  }
  await assert.rejects(repo.add('admin', wid, { subject: protectedSubjects[2], roles: ['viewer'], expected_version: 1 }), e => e.code === 'SERVICE_ACCOUNT_PROTECTED');
  assert.equal(providerCalls, 0);
  assert.equal((await workflows.get('core-service', 'operator', wid, document.id)).state, 'draft');
  assert.equal((await repo.list('admin', wid, 50)).version, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM core.audit_events WHERE action LIKE 'admin.%'")).rows[0].n, 0);
  await service.member('admin', wid, 'viewer', { active: false, roles: ['viewer'], expected_version: 1 });
  assert.equal(providerCalls, 0);
});
test('workspace admin scope, CAS, last admin, membership and read grants are transactional', async t => {
  const { pool, workspace: wid, otherWorkspace, sources } = await caseFixture(t);
  const r = createAdminRepository(pool), access = createAccessRepository(pool);
  await assert.rejects(r.list('operator', wid, 50), e => e.status === 403);
  await assert.rejects(r.list('admin', otherWorkspace, 50), e => e.status === 404);
  let v = (await r.list('admin', wid, 50)).version;
  await assert.rejects(r.member('admin', wid, 'admin', { active: false, roles: ['viewer'], expected_version: v }), e => e.code === 'LAST_ADMIN_REQUIRED');
  const results = await Promise.allSettled([true, false].map(enabled => r.source('admin', wid, 'viewer', sources[0], { enabled, expected_version: v })));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  v = (await r.list('admin', wid, 50)).version;
  await r.source('admin', wid, 'viewer', sources[0], { enabled: false, expected_version: v++ });
  assert.ok(!(await access.memberships('viewer', wid))[0].source_ids.includes(sources[0]));
  await r.member('admin', wid, 'viewer', { active: false, roles: ['viewer'], expected_version: v++ });
  assert.deepEqual(await access.memberships('viewer', wid), []);
  await assert.rejects(r.member('admin', wid, 'writer', { active: true, roles: ['admin'], expected_version: v }), e => e.code === 'SERVICE_ACCOUNT_PROTECTED');
  await assert.rejects(r.source('admin', wid, 'writer', sources[1], { enabled: true, expected_version: v }), e => e.code === 'SERVICE_ACCOUNT_PROTECTED');
  await pool.query("UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE grantee_subject='admin' AND source_id=$1", [sources[2]]);
  await assert.rejects(r.source('admin', wid, 'other', sources[2], { enabled: true, expected_version: v }), e => e.status === 404);
  await r.member('admin', wid, 'other', { active: true, roles: ['admin'], expected_version: v++ });
  const demotions = await Promise.allSettled(['admin', 'other'].map(actor => r.member(actor, wid, actor, { active: true, roles: ['viewer'], expected_version: v })));
  assert.equal(demotions.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM core.memberships m JOIN core.membership_roles r USING(workspace_id,subject) WHERE m.workspace_id=$1 AND m.revoked_at IS NULL AND r.role_key='admin'", [wid])).rows[0].n, 1);
});
test('account provisioning recovers same owned operation after DB/audit failure without password persistence', async t => {
  const { pool, workspace: wid } = await caseFixture(t);
  const repo = createAdminRepository(pool), accounts = new Map(); let creations = 0;
  const provider = { async create(username, password, marker) { if (!accounts.has(marker)) { creations++; accounts.set(marker, { subject: 'new-person', username }); } return accounts.get(marker); } };
  let fail = true;
  const service = createAdminService({ ...repo, finish: (...args) => { if (fail) throw Error('DB private error'); return repo.finish(...args); } }, provider, 'test-server-secret');
  const input = { username: 'new.person', temporary_password: 'synthetic-password-123', roles: ['operator'], expected_version: 1 };
  await assert.rejects(service.account('admin', wid, input, 'stable-key'), e => e.code === 'ACCOUNT_PROVISIONING_PENDING');
  assert.equal(creations, 1);
  const pending = (await pool.query('SELECT document FROM core.account_provisionings')).rows[0].document;
  assert.equal(pending.state, 'pending'); assert.ok(!JSON.stringify(pending).includes(input.temporary_password));
  assert.equal((await service.operation('admin', wid, 'stable-key')).state, 'pending');
  assert.equal((await service.operation('admin', wid, 'stable-key')).marker, undefined);
  await assert.rejects(service.operation('operator', wid, 'stable-key'), e => e.status === 403);
  fail = false;
  await pool.query(`CREATE FUNCTION core.fail_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='admin.account_linked' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_admin_audit BEFORE INSERT ON core.audit_events FOR EACH ROW EXECUTE FUNCTION core.fail_admin_audit()`);
  await assert.rejects(service.account('admin', wid, input, 'stable-key'), e => e.code === 'ACCOUNT_PROVISIONING_PENDING');
  assert.equal((await pool.query("SELECT count(*)::int n FROM core.memberships WHERE subject='new-person'")).rows[0].n, 0);
  assert.equal((await service.operation('admin', wid, 'stable-key')).state, 'pending');
  await pool.query('DROP TRIGGER fail_admin_audit ON core.audit_events; DROP FUNCTION core.fail_admin_audit()');
  await repo.member('admin', wid, 'viewer', { active: false, roles: ['viewer'], expected_version: 1 });
  await assert.rejects(service.account('admin', wid, input, 'stable-key'), e => e.code === 'VERSION_CONFLICT');
  input.expected_version = 2;
  const done = await service.account('admin', wid, input, 'stable-key');
  assert.equal(done.state, 'completed'); assert.equal(creations, 1);
  assert.deepEqual(await service.account('admin', wid, input, 'stable-key'), done);
  await assert.rejects(service.account('admin', wid, { ...input, roles: ['admin'] }, 'stable-key'), e => e.code === 'IDEMPOTENCY_CONFLICT');
  const audit = (await pool.query('SELECT after_ref FROM core.audit_events')).rows;
  assert.ok(!JSON.stringify(audit).includes(input.temporary_password));
});
