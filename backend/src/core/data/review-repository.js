// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { authorize } from './run-repository.js';
import { projectedLinks } from './link-projection.js';
import { assertAcyclicLink } from '../reconstruction/reviews.js';
import { ApiError } from '../identity/api-error.js';

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
export function createReviewRepository(pool) {
  async function mutate(subject, workspace, run, work) {
    return withTransaction(pool, async (client) => {
      // Every graph writer uses this lock, including future case evidence/closure writers.
      const { rows: [row] } = await client.query(`SELECT r.document,
        ARRAY(SELECT source_id::text FROM core.run_sources s WHERE s.workspace_id=r.workspace_id AND s.run_id=r.id) AS sources
        FROM core.reconstruction_runs r WHERE r.workspace_id=$1 AND r.id=$2 FOR UPDATE`, [workspace, run]);
      if (!row) throw notFound();
      await authorize(client, subject, workspace, row.sources, true);
      if (row.document.status !== 'completed') throw new ApiError(409, 'RUN_NOT_READY', 'Run graph is not ready');
      const result = await work(client);
      await authorize(client, subject, workspace, row.sources, true);
      return result;
    });
  }
  async function linksFor(client, workspace, run) {
    const { rows: [row] } = await client.query(`SELECT ARRAY(${projectedLinks}) AS links
      FROM core.reconstruction_runs r WHERE r.workspace_id=$1 AND r.id=$2`, [workspace, run]);
    return row.links;
  }
  async function audit(client, subject, workspace, action, id, before, after) {
    await client.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,before_ref,after_ref)
      VALUES($1,$2,$3,$4,'run_link',$5,$6,$7)`, [randomUUID(), workspace, subject, action, id, before, after]);
  }
  return {
    review(subject, workspace, run, id, input) {
      return mutate(subject, workspace, run, async (client) => {
        const links = await linksFor(client, workspace, run), link = links.find((entry) => entry.id === id);
        if (!link) throw notFound();
        if (link.version !== input.expected_version) throw new ApiError(409, 'VERSION_CONFLICT', 'Link version has changed');
        if (input.decision === 'accepted') assertAcyclicLink(links.filter((entry) => entry.id !== id), link.from_event_id, link.to_event_id);
        const { rows: [review] } = await client.query(`INSERT INTO core.link_reviews(id,workspace_id,run_id,link_id,link_version,decision,reason,actor_subject)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,link_id,link_version,decision,reason,actor_subject,created_at`,
        [randomUUID(), workspace, run, id, link.version + 1, input.decision, input.reason, subject]);
        review.created_at = review.created_at.toISOString();
        await audit(client, subject, workspace, 'link.reviewed', id,
          { run_id: run, version: link.version, review_state: link.review_state },
          { run_id: run, version: review.link_version, review_state: review.decision, review_id: review.id });
        return review;
      });
    },
    manual(subject, workspace, run, input) {
      return mutate(subject, workspace, run, async (client) => {
        const { from_event_id: from, to_event_id: to } = input;
        const { rows } = await client.query(`SELECT event_id FROM core.run_events
          WHERE workspace_id=$1 AND run_id=$2 AND event_id=ANY($3::uuid[])`, [workspace, run, [from, to]]);
        if (rows.length !== 2) throw notFound();
        const links = await linksFor(client, workspace, run);
        if (links.some((link) => link.from_event_id === from && link.to_event_id === to)) {
          throw new ApiError(409, 'LINK_EXISTS', 'Link already exists; review the existing link');
        }
        assertAcyclicLink(links, from, to);
        const link = { id: randomUUID(), from_event_id: from, to_event_id: to, method: 'manual', score: null,
          evidence: [{ reason_code: 'MANUAL_REASON', event_ids: [from, to], field: 'reason', observed_values: [input.reason] }],
          review_state: 'pending', version: 1 };
        await client.query(`INSERT INTO core.run_links(id,workspace_id,run_id,from_event_id,to_event_id,document)
          VALUES($1,$2,$3,$4,$5,$6)`, [link.id, workspace, run, from, to, link]);
        await audit(client, subject, workspace, 'link.manual_created', link.id, null, { run_id: run, version: 1 });
        return link;
      });
    },
  };
}
