// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { inspectRequest } from '../../../../simulator/lab-state.mjs';
import { authorize } from './run-repository.js';
import { ApiError } from '../identity/api-error.js';

export async function inspectCaseSource(client, subject, workspace, runId, write = true) {
  const { rows: [lab] } = await client.query('SELECT * FROM core.lab_sandboxes WHERE workspace_id=$1 FOR UPDATE', [workspace]);
  if (!lab) return null; // Existing non-sandbox integrations retain their original verification policy.
  await authorize(client, subject, workspace, lab.source_ids, write);
  const { rows: [root] } = await client.query(`SELECT e.document FROM core.reconstruction_runs r JOIN core.events e
    ON e.workspace_id=r.workspace_id AND e.event_id=r.root_event_id WHERE r.workspace_id=$1 AND r.id=$2
    AND e.source_id=ANY($3::uuid[]) AND EXISTS (SELECT 1 FROM core.lab_outbox o
      WHERE o.workspace_id=e.workspace_id AND o.source_id=e.source_id AND o.id::text=e.source_event_id
      AND o.delivered_at IS NOT NULL)`, [workspace, runId, lab.source_ids]);
  if (!root) return { result: 'inconclusive', reason: 'ROOT_NOT_SANDBOX_EVENT' };
  const ids = root?.document.identifiers?.filter(i => i.namespace === 'request').map(i => i.value) ?? [];
  if (new Set(ids).size !== 1) return { result: 'inconclusive', reason: 'ROOT_REQUEST_AMBIGUOUS' };
  let observation;
  try { observation = inspectRequest(lab.document, ids[0]); }
  catch { return { result: 'inconclusive', reason: 'SOURCE_REQUEST_NOT_FOUND' }; }
  const { rows: [delivery] } = await client.query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE o.delivered_at IS NOT NULL AND EXISTS (SELECT 1 FROM core.events e
      WHERE e.workspace_id=o.workspace_id AND e.source_id=o.source_id AND e.source_event_id=o.id::text))::int AS delivered
    FROM core.lab_outbox o WHERE o.workspace_id=$1 AND o.document->'payload'->>'attempt_id'=$2`,
    [workspace, observation.attempt?.id ?? '']);
  observation.delivery = { status: delivery.total > 0 && delivery.total === delivery.delivered ? 'delivered' : 'pending', ...delivery };
  return observation;
}
export async function verifiedClosure(client, subject, workspace, row) {
  const current = await inspectCaseSource(client, subject, workspace, row.run_id);
  if (!current) return null;
  const { rows: [proof] } = await client.query(`SELECT id,document FROM core.case_verifications
    WHERE workspace_id=$1 AND case_id=$2 AND case_version=$3 ORDER BY created_at DESC,id DESC LIMIT 1`, [workspace, row.id, row.version]);
  const saved = proof?.document.observation;
  if (current.result !== 'passed' || saved?.result !== 'passed' || current.delivery?.status !== 'delivered' ||
      saved.delivery?.status !== 'delivered' || saved.checker_version !== current.checker_version ||
      saved.attempt?.source_version !== current.attempt?.source_version ||
      saved.request_id !== current.request_id || saved.attempt?.id !== current.attempt?.id || saved.environment?.id !== current.environment?.id)
    throw new ApiError(422, 'VERIFICATION_REQUIRED', 'A current passing source verification is required before closing');
  return { verification_id: proof.id, ...proof.document };
}
