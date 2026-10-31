// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createWorkflowEngine } from './engine.js';
export function historyDto(row) {
  return {
    action: row.action,
    from_state: row.from_state,
    to_state: row.to_state,
    actor_subject: row.actor_subject,
    reason: row.reason,
    version: row.version,
    occurred_at: new Date(row.occurred_at).toISOString(),
    evidence_refs: row.evidence_refs,
  };
}
export async function appendHistory(
  client,
  workspace,
  instance,
  state,
  actor,
  action,
  reason,
  from,
  refs = [],
  snapshot = {},
) {
  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO core.workflow_history(workspace_id,instance_id,version,from_state,to_state,
    owner_subject,actor_subject,action,reason,evidence_refs,evidence_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      workspace,
      instance,
      state.version,
      from,
      state.state,
      state.owner_subject,
      actor,
      action,
      reason,
      refs,
      snapshot,
    ],
  );
  return row;
}
export async function createWorkflow(client, { id, workspace, creator, entity, definition }) {
  const engine = createWorkflowEngine(definition),
    snapshot = engine.snapshot();
  await client.query(
    `INSERT INTO core.workflow_instances(id,workspace_id,definition_key,definition_version,definition,entity_type,entity_id,creator_subject)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, workspace, snapshot.key, snapshot.version, snapshot, entity.type, entity.id, creator],
  );
  return appendHistory(
    client,
    workspace,
    id,
    { state: snapshot.initial, owner_subject: null, version: 1 },
    creator,
    'create',
    'Created',
    null,
  );
}
