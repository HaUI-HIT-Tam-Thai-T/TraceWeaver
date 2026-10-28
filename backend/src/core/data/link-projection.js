// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Embed in a single statement with the run scope so graph reads cannot mix revisions.
export const projectedLinks = `SELECT l.document || CASE WHEN review.id IS NULL THEN '{}'::jsonb
  ELSE jsonb_build_object('review_state', review.decision, 'version', review.link_version) END AS document
  FROM core.run_links l LEFT JOIN LATERAL (
    SELECT id,decision,link_version FROM core.link_reviews v
    WHERE v.workspace_id=l.workspace_id AND v.run_id=l.run_id AND v.link_id=l.id
    ORDER BY link_version DESC LIMIT 1
  ) review ON true WHERE l.workspace_id=r.workspace_id AND l.run_id=r.id
  ORDER BY l.from_event_id,l.to_event_id`;
