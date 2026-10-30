// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { visibleSource } from './access-repository.js';
import { ApiError } from './api-error.js';
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
const writerRoles = new Set(['operator', 'reviewer']), readerRoles = new Set(['viewer', 'operator', 'reviewer', 'admin']);
export async function authorize(client, subject, workspace, sources, write = false) {
  const { rows: [membership] } = await client.query(`SELECT ARRAY(SELECT role_key FROM core.membership_roles r
    WHERE r.workspace_id=m.workspace_id AND r.subject=m.subject) AS roles,
    ARRAY(SELECT s.id::text FROM core.sources s WHERE s.workspace_id=$2 AND s.id=ANY($3::uuid[]) AND ${visibleSource}) AS sources
    FROM core.memberships m WHERE m.workspace_id=$2 AND m.subject=$1 AND m.revoked_at IS NULL`, [subject, workspace, sources]);
  if (!membership) throw notFound();
  if (!membership.roles.some((role) => (write ? writerRoles : readerRoles).has(role))) {
    throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
  }
  if (membership.sources.length !== sources.length) throw notFound();
  return membership;
}
