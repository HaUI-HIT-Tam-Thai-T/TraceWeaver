// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { ApiError } from '../identity/api-error.js';

export function createIngestionRepository(pool) {
  return {
    async ingest(subject, workspace, sourceId, prepare) {
      return withTransaction(pool, async (client) => {
        const { rows: sources } = await client.query(
          `SELECT s.service,s.parser_version,
          EXISTS (SELECT 1 FROM core.membership_roles r WHERE r.workspace_id=s.workspace_id AND r.subject=$1 AND r.role_key='ingest_service') AS allowed_role
          FROM core.sources s JOIN core.memberships m ON m.workspace_id=s.workspace_id AND m.subject=$1 AND m.revoked_at IS NULL
          WHERE s.workspace_id=$2 AND s.id=$3 AND EXISTS (
            SELECT 1 FROM core.source_grants g WHERE g.workspace_id=s.workspace_id AND g.source_id=s.id
            AND g.permission='ingest' AND g.revoked_at IS NULL AND (g.grantee_subject=$1 OR EXISTS (
              SELECT 1 FROM core.group_members gm WHERE gm.workspace_id=g.workspace_id AND gm.group_id=g.group_id AND gm.subject=$1)))`,
          [subject, workspace, sourceId],
        );
        if (!sources.length) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
        if (!sources[0].allowed_role)
          throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
        const records = prepare(sources[0]);
        const batchId = randomUUID();
        const result = { batch_id: batchId, accepted: 0, duplicate: 0, rejected: 0, results: [] };
        await client.query(
          `INSERT INTO core.ingestion_batches(id,workspace_id,source_id,creator_subject,digest) VALUES ($1,$2,$3,$4,$5)`,
          [batchId, workspace, sourceId, subject, records.digest],
        );
        for (const [index, record] of records.items.entries()) {
          if (record.code) {
            result.rejected++;
            result.results.push({ client_index: index, status: 'rejected', code: record.code });
            continue;
          }
          const id = randomUUID();
          const inserted = await client.query(
            `INSERT INTO core.events(event_id,workspace_id,source_id,source_event_id,occurred_at,content_hash,document,batch_id,locator)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (workspace_id,source_id,source_event_id) DO NOTHING RETURNING event_id`,
            [
              id,
              workspace,
              sourceId,
              record.event.source_event_id,
              record.event.occurred_at,
              record.hash,
              record.event,
              batchId,
              `line:${index + 1}`,
            ],
          );
          if (inserted.rowCount) {
            result.accepted++;
            result.results.push({ client_index: index, status: 'accepted', event_id: id });
          } else {
            const {
              rows: [existing],
            } = await client.query(
              `SELECT event_id,content_hash FROM core.events WHERE workspace_id=$1 AND source_id=$2 AND source_event_id=$3`,
              [workspace, sourceId, record.event.source_event_id],
            );
            if (existing.content_hash === record.hash) {
              result.duplicate++;
              result.results.push({
                client_index: index,
                status: 'duplicate',
                event_id: existing.event_id,
              });
            } else {
              result.rejected++;
              result.results.push({
                client_index: index,
                status: 'rejected',
                code: 'SOURCE_EVENT_CONFLICT',
              });
            }
          }
        }
        await client.query(
          'UPDATE core.ingestion_batches SET accepted=$2,duplicate=$3,rejected=$4 WHERE id=$1',
          [batchId, result.accepted, result.duplicate, result.rejected],
        );
        await client.query(
          `INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,after_ref)
          VALUES ($1,$2,$3,'events.ingested','ingestion_batch',$4,$5)`,
          [
            randomUUID(),
            workspace,
            subject,
            batchId,
            { accepted: result.accepted, duplicate: result.duplicate, rejected: result.rejected },
          ],
        );
        return result;
      });
    },
  };
}
