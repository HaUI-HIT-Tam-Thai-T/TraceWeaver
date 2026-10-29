// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { inspectRequest } from '../../../../simulator/lab-state.mjs';
import { authorize } from './run-repository.js';
import { ApiError } from '../identity/api-error.js';

export async function inspectCaseSource(client, subject, workspace, runId) {
  const { rows: [lab] } = await client.query('SELECT * FROM core.lab_sandboxes WHERE workspace_id=$1 FOR UPDATE', [workspace]);
  if (!lab) return null; // Existing non-sandbox integrations retain their original verification policy.
  await authorize(client, subject, workspace, lab.source_ids, true);
  const { rows: [root] } = await client.query(`SELECT e.document FROM core.reconstruction_runs r JOIN core.events e
    ON e.workspace_id=r.workspace_id AND e.event_id=r.root_event_id WHERE r.workspace_id=$1 AND r.id=$2
    AND e.source_id=ANY($3::uuid[])`, [workspace, runId, lab.source_ids]);
  const ids = root?.document.identifiers?.filter(i => i.namespace === 'request').map(i => i.value) ?? [];
  if (new Set(ids).size !== 1) return { result: 'inconclusive', reason: 'ROOT_REQUEST_AMBIGUOUS' };
  try { return inspectRequest(lab.document, ids[0]); }
  catch { return { result: 'inconclusive', reason: 'SOURCE_REQUEST_NOT_FOUND' }; }
}
export async function verifiedClosure(client, subject, workspace, row) {
  const current = await inspectCaseSource(client, subject, workspace, row.run_id);
  if (!current) return null;
  const { rows: [proof] } = await client.query(`SELECT id,document FROM core.case_verifications
    WHERE workspace_id=$1 AND case_id=$2 AND case_version=$3 ORDER BY created_at DESC,id DESC LIMIT 1`, [workspace, row.id, row.version]);
  const saved = proof?.document.observation;
  if (current.result !== 'passed' || saved?.result !== 'passed' || saved.source_version !== current.source_version ||
      saved.request_id !== current.request_id || saved.attempt?.id !== current.attempt?.id || saved.environment?.id !== current.environment?.id)
    throw new ApiError(422, 'VERIFICATION_REQUIRED', 'A current passing source verification is required before closing');
  return { verification_id: proof.id, ...proof.document };
}
