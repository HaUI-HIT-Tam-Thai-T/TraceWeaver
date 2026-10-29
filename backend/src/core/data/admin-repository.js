// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { ApiError } from '../identity/api-error.js';
import { visibleSource } from '../identity/access-repository.js';
const error = (status, code, message) => { throw new ApiError(status, code, message); };
export function createAdminRepository(pool, { protectedSubjects = [] } = {}) {
  const services = new Set(protectedSubjects.filter(Boolean));
  async function humanTarget(c, wid, subject) {
    if (services.has(subject) || (await c.query("SELECT 1 FROM core.membership_roles WHERE workspace_id=$1 AND subject=$2 AND role_key='ingest_service'", [wid, subject])).rowCount)
      error(422, 'SERVICE_ACCOUNT_PROTECTED', 'Service accounts are managed outside this human administration API');
  }
  async function permitted(c, actor, wid) {
    const { rows: [row] } = await c.query(`SELECT EXISTS(SELECT 1 FROM core.membership_roles r WHERE r.workspace_id=m.workspace_id
      AND r.subject=m.subject AND r.role_key='admin') allowed FROM core.memberships m
      WHERE m.workspace_id=$1 AND m.subject=$2 AND m.revoked_at IS NULL`, [wid, actor]);
    if (!row) error(404, 'NOT_FOUND', 'Workspace not found');
    if (!row.allowed) error(403, 'FORBIDDEN', 'Workspace administrator required');
  }
  async function locked(c, actor, wid, expected) {
    await permitted(c, actor, wid);
    await c.query('INSERT INTO core.workspace_admin_versions(workspace_id) VALUES($1) ON CONFLICT DO NOTHING', [wid]);
    const { rows: [row] } = await c.query('SELECT version FROM core.workspace_admin_versions WHERE workspace_id=$1 FOR UPDATE', [wid]);
    await permitted(c, actor, wid);
    if (expected !== undefined && row.version !== expected) error(409, 'VERSION_CONFLICT', 'Workspace administration changed');
    return row.version;
  }
  async function audit(c, actor, wid, action, subject, data) {
    await c.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,after_ref)
      VALUES($1,$2,$3,$4,'workspace_member',$5,$6)`, [randomUUID(), wid, actor, action, subject, data]);
  }
  async function bump(c, wid) {
    return (await c.query('UPDATE core.workspace_admin_versions SET version=version+1 WHERE workspace_id=$1 RETURNING version', [wid])).rows[0].version;
  }
  async function add(c, wid, subject, roles) {
    await humanTarget(c, wid, subject);
    const inserted = await c.query('INSERT INTO core.memberships(workspace_id,subject) VALUES($1,$2) ON CONFLICT DO NOTHING', [wid, subject]);
    if (!inserted.rowCount) error(409, 'MEMBER_EXISTS', 'Membership already exists; edit it explicitly');
    for (const role of roles) await c.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES($1,$2,$3)', [wid, subject, role]);
  }
  return {
    authorize(actor, wid) { return permitted(pool, actor, wid); },
    operation(actor, wid, key) {
      return withTransaction(pool, async c => {
        const version = await locked(c, actor, wid);
        const { rows: [row] } = await c.query('SELECT document FROM core.account_provisionings WHERE workspace_id=$1 AND actor_subject=$2 AND key_hash=$3', [wid, actor, key]);
        if (!row) error(404, 'NOT_FOUND', 'Provisioning operation not found');
        const { marker, ...document } = row.document;
        return { ...document, current_version: version };
      });
    },
    list(actor, wid, limit, after) {
      return withTransaction(pool, async c => {
        const version = await locked(c, actor, wid);
        const { rows } = await c.query(`SELECT m.subject,m.revoked_at IS NULL AS active,
          ARRAY(SELECT role_key FROM core.membership_roles r WHERE r.workspace_id=m.workspace_id AND r.subject=m.subject ORDER BY role_key) roles,
          ARRAY(SELECT source_id::text FROM core.source_grants g WHERE g.workspace_id=m.workspace_id AND g.grantee_subject=m.subject AND permission='read' AND revoked_at IS NULL ORDER BY source_id) direct_source_ids
          FROM core.memberships m WHERE workspace_id=$1 AND ($2::text IS NULL OR subject>$2) ORDER BY subject LIMIT $3`, [wid, after ?? null, limit + 1]);
        return { workspace_id: wid, version, items: rows.slice(0, limit), next_after: rows.length > limit ? rows[limit - 1].subject : null };
      });
    },
    add(actor, wid, input) {
      return withTransaction(pool, async c => {
        await locked(c, actor, wid, input.expected_version);
        await add(c, wid, input.subject, input.roles);
        await audit(c, actor, wid, 'admin.member_added', input.subject, { roles: input.roles });
        return { subject: input.subject, active: true, roles: input.roles, version: await bump(c, wid) };
      });
    },
    member(actor, wid, subject, input) {
      return withTransaction(pool, async c => {
        await locked(c, actor, wid, input.expected_version);
        const { rows: [old] } = await c.query('SELECT revoked_at FROM core.memberships WHERE workspace_id=$1 AND subject=$2', [wid, subject]);
        if (!old) error(404, 'NOT_FOUND', 'Member not found');
        await humanTarget(c, wid, subject);
        const { rows: admins } = await c.query(`SELECT m.subject FROM core.memberships m JOIN core.membership_roles r USING(workspace_id,subject)
          WHERE m.workspace_id=$1 AND m.revoked_at IS NULL AND r.role_key='admin'`, [wid]);
        if (admins.some(a => a.subject === subject) && (!input.active || !input.roles.includes('admin')) && admins.length === 1)
          error(422, 'LAST_ADMIN_REQUIRED', 'At least one active workspace admin must remain');
        await c.query('UPDATE core.memberships SET revoked_at=CASE WHEN $3 THEN NULL ELSE COALESCE(revoked_at,clock_timestamp()) END WHERE workspace_id=$1 AND subject=$2', [wid, subject, input.active]);
        await c.query('DELETE FROM core.membership_roles WHERE workspace_id=$1 AND subject=$2', [wid, subject]);
        for (const role of input.roles) await c.query('INSERT INTO core.membership_roles(workspace_id,subject,role_key) VALUES($1,$2,$3)', [wid, subject, role]);
        await audit(c, actor, wid, 'admin.member_updated', subject, { active: input.active, roles: input.roles });
        return { subject, ...input, version: await bump(c, wid) };
      });
    },
    source(actor, wid, subject, sid, input) {
      return withTransaction(pool, async c => {
        await locked(c, actor, wid, input.expected_version);
        const visible = await c.query(`SELECT s.id FROM core.sources s WHERE s.workspace_id=$2 AND s.id=$3 AND ${visibleSource}`, [actor, wid, sid]);
        if (!visible.rowCount) error(404, 'NOT_FOUND', 'Source not found');
        const member = await c.query('SELECT 1 FROM core.memberships WHERE workspace_id=$1 AND subject=$2 AND revoked_at IS NULL', [wid, subject]);
        if (!member.rowCount) error(422, 'MEMBER_INACTIVE', 'Active membership required');
        await humanTarget(c, wid, subject);
        await c.query(`UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND source_id=$2 AND grantee_subject=$3 AND permission='read' AND revoked_at IS NULL`, [wid, sid, subject]);
        if (input.enabled) await c.query(`INSERT INTO core.source_grants(id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES($1,$2,$3,$4,'read',$5)`, [randomUUID(), wid, sid, subject, actor]);
        await audit(c, actor, wid, 'admin.direct_read_changed', subject, { source_id: sid, enabled: input.enabled });
        return { subject, source_id: sid, enabled: input.enabled, version: await bump(c, wid) };
      });
    },
    reserve(actor, wid, key, hash, input) {
      return withTransaction(pool, async c => {
        await locked(c, actor, wid);
        const { rows: [old] } = await c.query('SELECT request_hash,document FROM core.account_provisionings WHERE workspace_id=$1 AND actor_subject=$2 AND key_hash=$3', [wid, actor, key]);
        if (old) {
          if (old.request_hash !== hash) error(409, 'IDEMPOTENCY_CONFLICT', 'Key already used with different account input');
          return old.document;
        }
        const version = (await c.query('SELECT version FROM core.workspace_admin_versions WHERE workspace_id=$1', [wid])).rows[0].version;
        if (version !== input.expected_version) error(409, 'VERSION_CONFLICT', 'Workspace administration changed');
        const document = { state: 'pending', username: input.username, marker: randomUUID() };
        await c.query('INSERT INTO core.account_provisionings(workspace_id,actor_subject,key_hash,request_hash,document) VALUES($1,$2,$3,$4,$5)', [wid, actor, key, hash, document]);
        await audit(c, actor, wid, 'admin.account_requested', input.username, { operation_key_hash: key });
        return document;
      });
    },
    finish(actor, wid, key, account, input) {
      return withTransaction(pool, async c => {
        await locked(c, actor, wid);
        const { rows: [row] } = await c.query('SELECT document FROM core.account_provisionings WHERE workspace_id=$1 AND actor_subject=$2 AND key_hash=$3 FOR UPDATE', [wid, actor, key]);
        if (!row) error(409, 'OPERATION_NOT_FOUND', 'Provisioning operation not found');
        if (row.document.state === 'completed') return row.document;
        const version = (await c.query('SELECT version FROM core.workspace_admin_versions WHERE workspace_id=$1', [wid])).rows[0].version;
        if (version !== input.expected_version) error(409, 'VERSION_CONFLICT', 'Account may exist; retry same key with current workspace version');
        await add(c, wid, account.subject, input.roles);
        const result = { state: 'completed', ...account, roles: input.roles, active: true, version: await bump(c, wid) };
        await c.query('UPDATE core.account_provisionings SET document=$4 WHERE workspace_id=$1 AND actor_subject=$2 AND key_hash=$3', [wid, actor, key, result]);
        await audit(c, actor, wid, 'admin.account_linked', account.subject, { username: account.username, roles: input.roles });
        return result;
      });
    },
  };
}
