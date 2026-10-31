// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

const readRoles = "('viewer','operator','reviewer','admin')";
export const reader = `EXISTS (SELECT 1 FROM core.memberships m JOIN core.membership_roles r
  ON r.workspace_id=m.workspace_id AND r.subject=m.subject
  WHERE m.workspace_id=$2 AND m.subject=$1 AND m.revoked_at IS NULL AND r.role_key IN ${readRoles})`;
export const visibleSource = `EXISTS (SELECT 1 FROM core.source_grants g
  WHERE g.workspace_id=s.workspace_id AND g.source_id=s.id AND g.permission='read' AND g.revoked_at IS NULL
  AND (g.grantee_subject=$1 OR EXISTS (SELECT 1 FROM core.group_members gm
    WHERE gm.workspace_id=g.workspace_id AND gm.group_id=g.group_id AND gm.subject=$1)))`;

export function createAccessRepository(pool) {
  return {
    async memberships(subject, workspace = null) {
      const { rows } = await pool.query(
        `SELECT m.workspace_id,w.name AS workspace_name,
        ARRAY(SELECT r.role_key FROM core.membership_roles r WHERE r.workspace_id=m.workspace_id AND r.subject=m.subject ORDER BY r.role_key) AS roles,
        ARRAY(SELECT gm.group_id::text FROM core.group_members gm WHERE gm.workspace_id=m.workspace_id AND gm.subject=m.subject ORDER BY gm.group_id) AS group_ids,
        ARRAY(SELECT s.id::text FROM core.sources s WHERE s.workspace_id=m.workspace_id AND ${visibleSource} ORDER BY s.id) AS source_ids
        FROM core.memberships m JOIN core.workspaces w ON w.id=m.workspace_id WHERE m.subject=$1 AND m.revoked_at IS NULL
        AND ($2::uuid IS NULL OR m.workspace_id=$2) ORDER BY m.workspace_id`,
        [subject, workspace],
      );
      return rows;
    },
    async sources(subject, workspace, last, limit) {
      const { rows } = await pool.query(
        `SELECT s.id,s.workspace_id,s.name,s.service,s.parser_version
        FROM core.sources s WHERE s.workspace_id=$2 AND ${reader} AND ${visibleSource}
        AND ($3::uuid IS NULL OR s.id>$3) ORDER BY s.id LIMIT $4`,
        [subject, workspace, last, limit],
      );
      return rows;
    },
    async knowledge(subject, workspace, last, limit, q) {
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      const { rows } = await pool.query(
        `WITH latest AS (
        SELECT DISTINCT ON (id) id,workspace_id,title,body,version,author_subject,source_ref,created_at
        FROM core.knowledge_articles WHERE workspace_id=$2 ORDER BY id,version DESC
      ) SELECT * FROM latest WHERE ${reader} AND ($3::uuid IS NULL OR id>$3)
        AND (title ILIKE $5 OR body ILIKE $5) ORDER BY id LIMIT $4`,
        [subject, workspace, last, limit, pattern],
      );
      return rows.map((row) => ({ ...row, created_at: row.created_at.toISOString() }));
    },
  };
}
