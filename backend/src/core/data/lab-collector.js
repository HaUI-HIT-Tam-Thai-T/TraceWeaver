// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { withTransaction } from './database.js';

// At-least-once delivery through the existing ingestion boundary and its current grants.
// Stable source_event_id makes a retry after a crash harmless.
export function createLabCollector(pool, ingestion, subject) {
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) throw new Error('Invalid lab ingest subject');
  return async function collect(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid collector limit');
    return withTransaction(pool, async client => {
      const { rows } = await client.query(`SELECT * FROM core.lab_outbox WHERE delivered_at IS NULL
        ORDER BY attempts,id LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
      let delivered = 0;
      for (const row of rows) {
        let code = null;
        try {
          const result = await ingestion.batch(subject, row.workspace_id, row.source_id, { events: [row.document] });
          if (result.rejected) code = result.results[0]?.code ?? 'INGEST_REJECTED';
        } catch { code = 'INGEST_UNAVAILABLE'; }
        await client.query(`UPDATE core.lab_outbox SET attempts=attempts+1,last_error=$2,
          delivered_at=CASE WHEN $2::text IS NULL THEN clock_timestamp() ELSE NULL END WHERE id=$1`, [row.id, code]);
        if (!code) delivered++;
      }
      return { examined: rows.length, delivered };
    });
  };
}
