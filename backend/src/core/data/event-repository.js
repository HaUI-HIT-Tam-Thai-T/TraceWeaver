// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { reader, visibleSource } from '../identity/access-repository.js';
const fields = `e.event_id,e.source_id,e.source_event_id,e.received_at,e.document,e.batch_id,e.locator,e.content_hash,
  to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_time`;
const scope = `e.workspace_id=$2 AND e.source_id=ANY($3::uuid[]) AND ${reader} AND ${visibleSource}`;
function dto(row) {
  return { ...row.document, event_id: row.event_id, source_id: row.source_id, source_event_id: row.source_event_id,
    received_at: row.received_at.toISOString(),
    provenance: { batch_id: row.batch_id, locator: row.locator, sha256_redacted: row.content_hash } };
}
export function createEventRepository(pool) {
  return {
    async snapshot() {
      return (await pool.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0].snapshot;
    },
    async page(subject, workspace, sourceIds, filters, snapshot, last) {
      const pattern = `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`;
      const { rows } = await pool.query(`SELECT ${fields} FROM core.events e
        JOIN core.sources s ON s.workspace_id=e.workspace_id AND s.id=e.source_id
        WHERE ${scope} AND pg_visible_in_snapshot(e.insert_xid,$4::pg_snapshot)
        AND ($5::uuid IS NULL OR e.source_id=$5) AND ($6::timestamptz IS NULL OR e.occurred_at >= $6)
        AND ($7::timestamptz IS NULL OR e.occurred_at <= $7)
        AND ($8::text IS NULL OR e.document->>'action'=$8)
        AND (e.document->>'message' ILIKE $9 OR e.document->>'action' ILIKE $9 OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(e.document->'identifiers') i WHERE i->>'value' ILIKE $9 OR i->>'namespace' ILIKE $9))
        AND ($10::timestamptz IS NULL OR (e.occurred_at,e.event_id)>($10::timestamptz,$11::uuid))
        ORDER BY e.occurred_at,e.event_id LIMIT $12`,
      [subject, workspace, sourceIds, snapshot, filters.source_id || null, filters.from || null, filters.to || null,
        filters.action || null, pattern, last?.occurred_at ?? null, last?.event_id ?? null, filters.limit + 1]);
      return rows.map((row) => ({ event: dto(row), occurred_at: row.sort_time }));
    },
    async detail(subject, workspace, sourceIds, id) {
      const { rows } = await pool.query(`SELECT ${fields} FROM core.events e
        JOIN core.sources s ON s.workspace_id=e.workspace_id AND s.id=e.source_id
        WHERE ${scope} AND e.event_id=$4`, [subject, workspace, sourceIds, id]);
      return rows[0] ? dto(rows[0]) : null;
    },
  };
}
