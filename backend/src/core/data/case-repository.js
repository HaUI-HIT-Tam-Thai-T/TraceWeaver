// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { authorize, artifactScope } from './run-repository.js';
import { projectedLinks } from './link-projection.js';
import { digest } from './event-normalizer.js';
import { createWorkflow, appendHistory, latestWorkflow, historyDto } from './workflow-store.js';
import { createWorkflowEngine } from '../workflow/engine.js';
import { caseDefinition } from '../workflow/definitions.js';
import { ApiError } from '../identity/api-error.js';
import { artifactTimeScope, artifactTimeValues } from './artifact-time.js';

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
const projection = `SELECT c.*,h.to_state,h.owner_subject,h.version,h.occurred_at AS updated_at
  FROM core.cases c JOIN core.reconstruction_runs r ON r.workspace_id=c.workspace_id AND r.id=c.run_id
  JOIN LATERAL (${latestWorkflow}) h ON true`;
function caseDto(row) {
  return { id: row.id, workspace_id: row.workspace_id, run_id: row.run_id, workflow_instance_id: row.workflow_instance_id,
    title: row.title, creator_subject: row.creator_subject, owner_id: row.owner_subject, state: row.to_state, version: row.version,
    created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString() };
}
async function lockRun(client, subject, workspace, id, write = true) {
  const { rows: [run] } = await client.query(`SELECT r.document,
    ARRAY(SELECT source_id::text FROM core.run_sources s WHERE s.workspace_id=r.workspace_id AND s.run_id=r.id) AS sources
    FROM core.reconstruction_runs r WHERE r.workspace_id=$1 AND r.id=$2 FOR UPDATE`, [workspace, id]);
  if (!run) throw notFound();
  const actor = await authorize(client, subject, workspace, run.sources, write);
  if (run.document.status !== 'completed') throw new ApiError(409, 'RUN_NOT_READY', 'Run graph is not ready');
  return { ...run, actor: { subject, roles: actor.roles } };
}
async function ownerValid(client, owner, workspace, sources) {
  if (!owner) return false;
  try { await authorize(client, owner, workspace, sources, true); return true; }
  catch (error) { if (error instanceof ApiError) return false; throw error; }
}
async function audit(client, workspace, subject, action, id, before, after) {
  await client.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,before_ref,after_ref)
    VALUES($1,$2,$3,$4,'case',$5,$6,$7)`, [randomUUID(), workspace, subject, action, id, before, after]);
}
// Advisory lock precedes the run lock on every route; retry responses never bypass current ACL/roles.
async function idempotency(client, subject, workspace, route, input, key) {
  if (!key) return { replay: async () => null, save: async () => {} };
  const keyHash = digest(key), requestHash = digest(input);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([workspace, subject, route, keyHash])]);
  return {
    async replay() {
      const { rows: [row] } = await client.query(`SELECT request_hash,response FROM core.case_idempotency
        WHERE workspace_id=$1 AND actor_subject=$2 AND route=$3 AND key_hash=$4 AND expires_at>clock_timestamp()`, [workspace, subject, route, keyHash]);
      if (!row) return null;
      if (row.request_hash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with different input');
      return row.response;
    },
    async save(id, response) {
      await client.query(`INSERT INTO core.case_idempotency(workspace_id,actor_subject,route,key_hash,request_hash,case_id,response,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '24 hours')
        ON CONFLICT(workspace_id,actor_subject,route,key_hash) DO UPDATE SET request_hash=EXCLUDED.request_hash,
          case_id=EXCLUDED.case_id,response=EXCLUDED.response,expires_at=EXCLUDED.expires_at`, [workspace, subject, route, keyHash, requestHash, id, response]);
    },
  };
}
export function createCaseRepository(pool) {
  async function lookup(client, workspace, id) {
    const { rows: [row] } = await client.query(`${projection} WHERE c.workspace_id=$1 AND c.id=$2`, [workspace, id]);
    if (!row) throw notFound();
    return row;
  }
  async function lockedCase(client, subject, workspace, id) {
    const initial = await lookup(client, workspace, id);
    const run = await lockRun(client, subject, workspace, initial.run_id);
    const row = await lookup(client, workspace, id);
    const { rows: [instance] } = await client.query(`SELECT definition FROM core.workflow_instances WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [workspace, row.workflow_instance_id]);
    return { row, run, engine: createWorkflowEngine(instance.definition) };
  }
  return {
    create(subject, workspace, input, key) {
      return withTransaction(pool, async (client) => {
        const retry = await idempotency(client, subject, workspace, 'cases', input, key);
        const run = await lockRun(client, subject, workspace, input.run_id);
        const replay = await retry.replay(); if (replay) return replay;
        const id = randomUUID(), instance = randomUUID();
        const history = await createWorkflow(client, { id: instance, workspace, creator: subject, entity: { type: 'case', id }, definition: caseDefinition });
        const { rows: [row] } = await client.query(`INSERT INTO core.cases(id,workspace_id,run_id,workflow_instance_id,title,creator_subject,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, workspace, input.run_id, instance, input.title, subject, history.occurred_at]);
        const result = caseDto({ ...row, to_state: history.to_state, owner_subject: null, version: 1, updated_at: history.occurred_at });
        await audit(client, workspace, subject, 'case.created', id, null, { version: 1, state: result.state, run_id: input.run_id });
        await retry.save(id, result); await authorize(client, subject, workspace, run.sources, true);
        return result;
      });
    },
    async get(subject, workspace, id) {
      const initial = await lookup(pool, workspace, id);
      const { rows: scope } = await pool.query('SELECT source_id::text FROM core.run_sources WHERE workspace_id=$1 AND run_id=$2', [workspace, initial.run_id]);
      await authorize(pool, subject, workspace, scope.map((row) => row.source_id));
      // Everything returned to the client is captured in one SQL statement with current artifact scope.
      const { rows: [row] } = await pool.query(`SELECT summary.*,
        ARRAY(SELECT to_jsonb(wh) FROM core.workflow_history wh WHERE wh.workspace_id=summary.workspace_id
          AND wh.instance_id=summary.workflow_instance_id ORDER BY wh.version) AS history,
        ARRAY(SELECT e.document FROM core.case_evidence e WHERE e.workspace_id=summary.workspace_id AND e.case_id=summary.id ORDER BY e.id) AS evidence
        FROM (${projection} WHERE c.workspace_id=$2 AND c.id=$3 AND ${artifactScope}) summary`, [subject, workspace, id]);
      if (!row) throw notFound();
      return { case: caseDto(row), history: row.history.map(historyDto), evidence: row.evidence };
    },
    async list(subject, workspace, last, limit, state, owner, filters = {}) {
      const { rows } = await pool.query(`${projection} WHERE c.workspace_id=$2 AND ${artifactScope}
        AND ($3::uuid IS NULL OR c.id>$3) AND ($5='' OR h.to_state=$5) AND ($6='' OR h.owner_subject=$6)
        AND ${artifactTimeScope(7)}
        ORDER BY c.id LIMIT $4`, [subject, workspace, last, limit, state, owner, ...artifactTimeValues(filters)]);
      return rows.map(caseDto);
    },
    evidence(subject, workspace, id, input) {
      return withTransaction(pool, async (client) => {
        const { row, run } = await lockedCase(client, subject, workspace, id);
        if (row.to_state === 'closed') throw new ApiError(409, 'CASE_CLOSED', 'Reopen the case before adding evidence');
        const { rows: refs } = await client.query(`SELECT event_id FROM core.run_events WHERE workspace_id=$1 AND run_id=$2 AND event_id=ANY($3::uuid[])`,
          [workspace, row.run_id, input.event_ids]);
        if (refs.length !== input.event_ids.length) throw notFound();
        const evidence = { id: randomUUID(), case_id: id, ...input, creator_subject: subject, created_at: new Date().toISOString() };
        await client.query(`INSERT INTO core.case_evidence(id,workspace_id,case_id,run_id,document) VALUES($1,$2,$3,$4,$5)`,
          [evidence.id, workspace, id, row.run_id, evidence]);
        await client.query(`INSERT INTO core.case_evidence_events(workspace_id,case_id,evidence_id,run_id,event_id)
          SELECT $1,$2,$3,$4,unnest($5::uuid[])`, [workspace, id, evidence.id, row.run_id, input.event_ids]);
        await audit(client, workspace, subject, 'case.evidence_added', id, null, { evidence_id: evidence.id, version: row.version });
        await authorize(client, subject, workspace, run.sources, true);
        return evidence;
      });
    },
    transition(subject, workspace, id, input, key, context = {}) {
      return withTransaction(pool, async (client) => {
        if (context.authorize) await context.authorize(client);
        const retry = await idempotency(client, subject, workspace, `cases/${id}/transitions`, input, key);
        const { row, run, engine } = await lockedCase(client, subject, workspace, id);
        const current = { state: row.to_state, owner_subject: row.owner_subject, version: row.version };
        engine.authorize(current, input.action, run.actor);
        const replay = await retry.replay(); if (replay) return replay;
        const { rows: [data] } = await client.query(`SELECT ARRAY(${projectedLinks}) AS links,
          ARRAY(SELECT e.document FROM core.case_evidence e WHERE e.workspace_id=r.workspace_id AND e.case_id=$3) AS evidence,
          (SELECT reason FROM core.workflow_history h WHERE h.workspace_id=r.workspace_id AND h.instance_id=$4
            AND h.to_state='closed' ORDER BY version DESC LIMIT 1) AS close_reason
          FROM core.reconstruction_runs r WHERE r.workspace_id=$1 AND r.id=$2`, [workspace, row.run_id, id, row.workflow_instance_id]);
        if (context.evidenceRefs?.some((ref) => !data.evidence.some((e) => e.id === ref))) throw notFound();
        const owner = input.action === 'assign' ? input.owner_id : current.owner_subject;
        const next = engine.transition(current, { ...input, owner_subject: owner }, run.actor, {
          valid_owner: await ownerValid(client, owner, workspace, run.sources), has_note: data.evidence.some((e) => e.note.trim()),
          evidence_count: data.evidence.length, pending_links: data.links.filter((link) => link.review_state === 'pending').length,
          new_reason: input.reason !== data.close_reason,
        });
        const snapshot = input.action === 'verify_close' ? { links: data.links.map(({ id, version, review_state }) => ({ id, version, review_state })) } : {};
        const history = await appendHistory(client, workspace, row.workflow_instance_id, next, subject, input.action, input.reason,
          current.state, data.evidence.map((e) => e.id), snapshot);
        const result = caseDto({ ...row, to_state: next.state, owner_subject: next.owner_subject, version: next.version, updated_at: history.occurred_at });
        await audit(client, workspace, subject, 'case.transitioned', id, { version: current.version, state: current.state },
          { version: next.version, state: next.state, action: input.action, ...(context.appSubject ? { app_subject: context.appSubject } : {}) });
        await retry.save(id, result); await authorize(client, subject, workspace, run.sources, true);
        if (!await ownerValid(client, owner, workspace, run.sources)) throw new ApiError(422, 'GUARD_FAILED', 'Owner no longer has the required scope');
        if (context.authorize) await context.authorize(client);
        return context.respond ? context.respond(client) : result;
      });
    },
  };
}
