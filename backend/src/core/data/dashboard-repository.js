// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { artifactScope } from './run-repository.js';
import { projectedLinks } from './link-projection.js';
import { latestWorkflow } from './workflow-store.js';
import { artifactTimeScope, artifactTimeValues } from './artifact-time.js';
import { ApiError } from '../identity/api-error.js';

export function createDashboardRepository(pool) {
  return {
    async get(subject, workspace, filters) {
      // Scope, latest review/history and counters share one MVCC statement snapshot.
      const { rows: [row] } = await pool.query(`WITH RECURSIVE
        visible_runs AS MATERIALIZED (
          SELECT r.* FROM core.reconstruction_runs r
          WHERE r.workspace_id=$2 AND ${artifactScope} AND ${artifactTimeScope(3)}
        ), edges AS MATERIALIZED (
          SELECT r.id AS run_id, link.document->>'from_event_id' AS a, link.document->>'to_event_id' AS b
          FROM visible_runs r CROSS JOIN LATERAL (${projectedLinks}) link
          WHERE link.document->>'review_state'<>'rejected' AND r.document->>'status'='completed'
        ), connected(run_id,event_id) AS (
          SELECT id,root_event_id::text FROM visible_runs WHERE document->>'status'='completed'
          UNION
          SELECT c.run_id,CASE WHEN e.a=c.event_id THEN e.b ELSE e.a END
          FROM connected c JOIN edges e ON e.run_id=c.run_id AND (e.a=c.event_id OR e.b=c.event_id)
        ) SELECT
          (SELECT ARRAY(SELECT role_key FROM core.membership_roles mr WHERE mr.workspace_id=m.workspace_id AND mr.subject=m.subject)
            FROM core.memberships m WHERE m.workspace_id=$2 AND m.subject=$1 AND m.revoked_at IS NULL) AS roles,
          (SELECT count(*)::int FROM visible_runs) AS runs,
          (SELECT count(*)::int FROM visible_runs WHERE document->'degraded'='true'::jsonb) AS degraded_runs,
          (SELECT count(*)::int FROM visible_runs r JOIN core.run_events re ON re.workspace_id=r.workspace_id AND re.run_id=r.id
            WHERE r.document->>'status'='completed' AND NOT EXISTS (
              SELECT 1 FROM connected c WHERE c.run_id=r.id AND c.event_id=re.event_id::text)) AS unresolved_events,
          (SELECT count(*)::int FROM core.cases c JOIN visible_runs r ON r.workspace_id=c.workspace_id AND r.id=c.run_id
            JOIN LATERAL (${latestWorkflow}) h ON true WHERE h.to_state IN ('new','assigned')) AS waiting_cases`,
      [subject, workspace, ...artifactTimeValues(filters)]);
      if (row.roles === null) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      if (!row.roles.some((role) => ['viewer', 'operator', 'reviewer', 'admin'].includes(role))) {
        throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
      }
      const { roles, ...counts } = row;
      return { ...counts, filters };
    },
  };
}
