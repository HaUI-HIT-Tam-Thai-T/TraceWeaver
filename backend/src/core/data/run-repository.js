// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { eventDto } from './event-repository.js';
import { digest } from './event-normalizer.js';
import { reader, visibleSource } from '../identity/access-repository.js';
import { ApiError } from '../identity/api-error.js';
import { createRuleEngine } from '../reconstruction/rules.js';
import { compileRulePolicy } from '../reconstruction/candidates.js';
import { sandboxRulePolicy, missingSteps } from '../reconstruction/policy.js';
import { graphProjection } from '../reconstruction/reviews.js';
import { projectedLinks } from './link-projection.js';

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
const writerRoles = new Set(['operator', 'reviewer']), readerRoles = new Set(['viewer', 'operator', 'reviewer', 'admin']);
function sqlBound(value, lower) {
  const fraction = value.includes('.') ? value.slice(20, -1) : '';
  return [`${value.slice(0, 19)}Z`, Number(fraction.padEnd(6, '0').slice(0, 6))
    + (lower && /[1-9]/.test(fraction.slice(6)) ? 1 : 0)];
}
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
}
const artifactScope = `${reader} AND NOT EXISTS (
  SELECT 1 FROM core.run_sources rs WHERE rs.workspace_id=r.workspace_id AND rs.run_id=r.id
  AND NOT EXISTS (SELECT 1 FROM core.sources s WHERE s.workspace_id=rs.workspace_id AND s.id=rs.source_id AND ${visibleSource}))`;

export function createRunRepository(pool, configuration = sandboxRulePolicy()) {
  const policy = compileRulePolicy(configuration), reconstruct = createRuleEngine(policy);
  async function read(client, subject, workspace, id, graph) {
    const { rows: [row] } = await client.query(`SELECT r.document,r.graph_metadata,
      ARRAY(SELECT to_jsonb(e) FROM core.events e JOIN core.run_events re
        ON re.workspace_id=e.workspace_id AND re.event_id=e.event_id
        WHERE re.workspace_id=r.workspace_id AND re.run_id=r.id ORDER BY e.occurred_at,e.event_id) AS event_rows,
      ARRAY(${projectedLinks}) AS links,
      1 + (SELECT count(*)::int FROM core.link_reviews v WHERE v.workspace_id=r.workspace_id AND v.run_id=r.id)
        + (SELECT count(*)::int FROM core.run_links l WHERE l.workspace_id=r.workspace_id AND l.run_id=r.id
          AND l.document->>'method'='manual') AS graph_version
      FROM core.reconstruction_runs r WHERE r.workspace_id=$2 AND r.id=$3 AND ${artifactScope}`, [subject, workspace, id]);
    if (!row) throw notFound();
    if (!graph) return row.document;
    if (row.document.status !== 'completed') throw new ApiError(409, 'RUN_NOT_READY', 'Run graph is not ready');
    const nodes = row.event_rows.map(eventDto);
    return { run_id: id, nodes, links: row.links, ...row.graph_metadata,
      ...graphProjection(row.document.root_event_id, nodes, row.links), version: row.graph_version };
  }
  return {
    create(subject, workspace, input, key = null) {
      return withTransaction(pool, async (client) => {
        const keyHash = key ? digest(key) : null, requestHash = digest(input);
        if (keyHash) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([workspace, subject, 'runs', keyHash])]);
        await authorize(client, subject, workspace, input.source_ids, true);
        if (keyHash) {
          const { rows: [existing] } = await client.query(`SELECT request_hash,run_id,response FROM core.run_idempotency
            WHERE workspace_id=$1 AND actor_subject=$2 AND route='runs' AND key_hash=$3 AND expires_at>clock_timestamp()`, [workspace, subject, keyHash]);
          if (existing) {
            if (existing.request_hash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with different input');
            await read(client, subject, workspace, existing.run_id, false);
            return existing.response;
          }
          await client.query(`DELETE FROM core.run_idempotency WHERE workspace_id=$1 AND actor_subject=$2 AND route='runs' AND key_hash=$3`, [workspace, subject, keyHash]);
        }
        const { rows } = await client.query(`SELECT e.* FROM core.events e JOIN core.sources s
          ON s.workspace_id=e.workspace_id AND s.id=e.source_id WHERE e.workspace_id=$2 AND e.source_id=ANY($3::uuid[])
          AND e.occurred_at >= ($4::timestamptz + $5::int*interval '1 microsecond')
          AND e.occurred_at <= ($6::timestamptz + $7::int*interval '1 microsecond') AND ${reader} AND ${visibleSource}
          ORDER BY e.occurred_at,e.event_id LIMIT 1001`, [subject, workspace, input.source_ids,
          ...sqlBound(input.window.from, true), ...sqlBound(input.window.to, false)]);
        if (rows.length > 1000) throw new ApiError(422, 'WINDOW_TOO_LARGE', 'Run window exceeds 1000 events; narrow the window or sources');
        const events = rows.map(eventDto), created_at = new Date().toISOString();
        const result = reconstruct({ ...input, events }), id = randomUUID(), input_snapshot_id = randomUUID();
        const document = { id, status: 'completed', mode: input.mode, root_event_id: input.root_event_id,
          input_snapshot_id, rule_version: policy.version, model_version: null, created_at, completed_at: new Date().toISOString(),
          degraded: input.mode === 'hybrid', degraded_reason: input.mode === 'hybrid' ? 'ai_unavailable' : null,
          effective_method: 'rule_only', error: null };
        const connected = new Set(result.event_ids);
        const metadata = { unresolved_event_ids: result.unresolved_event_ids,
          missing_expected_steps: missingSteps(events.filter((event) => connected.has(event.event_id))), version: 1 };
        // Recheck current grants before committing after bounded CPU work.
        await authorize(client, subject, workspace, input.source_ids, true);
        await client.query(`INSERT INTO core.reconstruction_runs(id,workspace_id,creator_subject,root_event_id,input_snapshot_id,request,policy,document,graph_metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, workspace, subject, input.root_event_id, input_snapshot_id, input, policy, document, metadata]);
        await client.query(`INSERT INTO core.run_sources(workspace_id,run_id,source_id) SELECT $1,$2,unnest($3::uuid[])`, [workspace, id, input.source_ids]);
        await client.query(`INSERT INTO core.run_events(workspace_id,run_id,source_id,event_id)
          SELECT $1,$2,source_id,event_id FROM unnest($3::uuid[],$4::uuid[]) AS snapshot(source_id,event_id)`,
        [workspace, id, events.map((event) => event.source_id), events.map((event) => event.event_id)]);
        const links = result.links.map((link) => ({ ...link, id: randomUUID() }));
        await client.query(`INSERT INTO core.run_links(id,workspace_id,run_id,from_event_id,to_event_id,document)
          SELECT (link->>'id')::uuid,$1,$2,(link->>'from_event_id')::uuid,(link->>'to_event_id')::uuid,link
          FROM jsonb_array_elements($3::jsonb) link`, [workspace, id, JSON.stringify(links)]);
        await client.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,after_ref)
          VALUES ($1,$2,$3,'reconstruction.created','reconstruction_run',$4,$5)`, [randomUUID(), workspace, subject, id,
          { input_snapshot_id, event_count: events.length, rule_version: policy.version, effective_method: 'rule_only', degraded: document.degraded }]);
        if (keyHash) await client.query(`INSERT INTO core.run_idempotency(workspace_id,actor_subject,route,key_hash,request_hash,run_id,response,expires_at)
          VALUES ($1,$2,'runs',$3,$4,$5,$6,clock_timestamp()+interval '24 hours')`, [workspace, subject, keyHash, requestHash, id, document]);
        return document;
      });
    },
    async get(subject, workspace, id, graph = false) {
      // Membership/role errors match other read services; resource/grant scope stays opaque404.
      const { rows: [scope] } = await pool.query(`SELECT ARRAY(SELECT source_id::text FROM core.run_sources rs
        WHERE rs.workspace_id=r.workspace_id AND rs.run_id=r.id) AS sources
        FROM core.reconstruction_runs r WHERE r.workspace_id=$1 AND r.id=$2`, [workspace, id]);
      if (!scope) throw notFound();
      await authorize(pool, subject, workspace, scope.sources);
      return read(pool, subject, workspace, id, graph);
    },
  };
}
