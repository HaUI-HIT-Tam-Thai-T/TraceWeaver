// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from './database.js';
import { authorize, artifactScope } from './run-repository.js';
import { reader } from '../identity/access-repository.js';
import { createWorkflow, appendHistory, historyDto } from './workflow-store.js';
import { createWorkflowEngine } from '../workflow/engine.js';
import { documentReviewDefinition } from '../workflow/definitions.js';
import { createCaseRepository } from './case-repository.js';
import { caseInput } from '../../validations/case.validation.js';
import { ApiError } from '../identity/api-error.js';
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
async function serviceMember(client, app, workspace) {
  const { rowCount } = await client.query('SELECT 1 FROM core.memberships WHERE workspace_id=$1 AND subject=$2 AND revoked_at IS NULL', [workspace, app]);
  if (!rowCount) throw notFound();
}
function dto(row) {
  return { id: row.id, workspace_id: row.workspace_id, definition_key: row.definition_key, definition_version: row.definition_version,
    entity_ref: { type: row.entity_type, id: row.entity_id }, state: row.to_state, owner_subject: row.owner_subject,
    version: row.version, history: row.history.map(historyDto) };
}
async function read(client, app, subject, workspace, id) {
  await serviceMember(client, app, workspace); await authorize(client, subject, workspace, []);
  const { rows: [row] } = await client.query(`SELECT i.*,h.to_state,h.owner_subject,h.version,
    ARRAY(SELECT to_jsonb(wh) FROM core.workflow_history wh WHERE wh.workspace_id=i.workspace_id AND wh.instance_id=i.id ORDER BY version) AS history,
    c.id AS case_id
    FROM core.workflow_instances i
    JOIN LATERAL (SELECT * FROM core.workflow_history h WHERE h.workspace_id=i.workspace_id AND h.instance_id=i.id ORDER BY version DESC LIMIT 1) h ON true
    LEFT JOIN core.cases c ON c.workspace_id=i.workspace_id AND c.workflow_instance_id=i.id AND c.id=i.entity_id AND i.entity_type='case'
    LEFT JOIN core.reconstruction_runs r ON r.workspace_id=c.workspace_id AND r.id=c.run_id
    WHERE i.workspace_id=$2 AND i.id=$3 AND ${reader}
    AND EXISTS(SELECT 1 FROM core.memberships sm WHERE sm.workspace_id=i.workspace_id AND sm.subject=$4 AND sm.revoked_at IS NULL)
    AND ((i.definition_key='document_review' AND i.entity_type='document') OR (i.definition_key='case_handling' AND c.id IS NOT NULL AND ${artifactScope}))`,
  [subject, workspace, id, app]);
  if (!row) throw notFound();
  return row;
}
async function audit(client, app, subject, workspace, id, action, state) {
  await client.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,after_ref)
    VALUES($1,$2,$3,$4,'workflow_instance',$5,$6)`, [randomUUID(), workspace, subject, action, id,
    { app_subject: app, state: state.state, version: state.version }]);
}
export function createWorkflowRepository(pool) {
  const cases = createCaseRepository(pool);
  return {
    create(app, subject, workspace, input) {
      return withTransaction(pool, async (client) => {
        await serviceMember(client, app, workspace); await authorize(client, subject, workspace, [], true);
        if (input.definition_key === 'case_handling' && input.definition_version === 1 && input.entity_ref.type === 'case') {
          // Case creation owns the run/evidence relationship. Core never creates an unbound case workflow.
          const detail = await cases.get(subject, workspace, input.entity_ref.id, client);
          if (detail) throw new ApiError(409, 'WORKFLOW_EXISTS', 'Case workflow already exists; use its workflow_instance_id');
        }
        if (input.definition_key !== 'document_review' || input.definition_version !== 1 || input.entity_ref.type !== 'document') {
          throw new ApiError(422, 'INVALID_DEFINITION', 'Workflow definition, version or entity type is not supported');
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([workspace, input.entity_ref.type, input.entity_ref.id])]);
        const { rowCount } = await client.query('SELECT 1 FROM core.workflow_instances WHERE workspace_id=$1 AND entity_type=$2 AND entity_id=$3',
          [workspace, input.entity_ref.type, input.entity_ref.id]);
        if (rowCount) throw new ApiError(409, 'WORKFLOW_EXISTS', 'Entity already has a workflow');
        const id = randomUUID();
        const history = await createWorkflow(client, { id, workspace, creator: subject, entity: input.entity_ref, definition: documentReviewDefinition });
        await audit(client, app, subject, workspace, id, 'workflow.created', { state: history.to_state, version: 1 });
        await authorize(client, subject, workspace, [], true);
        return dto(await read(client, app, subject, workspace, id));
      });
    },
    async get(app, subject, workspace, id) { return dto(await read(pool, app, subject, workspace, id)); },
    async transition(app, subject, workspace, id, input) {
      const initial = await read(pool, app, subject, workspace, id);
      if (initial.case_id) {
        const command = caseInput('CaseTransition', { action: input.action, expected_version: input.expected_version, reason: input.reason,
          ...(input.owner_subject === undefined ? {} : { owner_id: input.owner_subject }) });
        return cases.transition(subject, workspace, initial.case_id, command, null, {
          authorize: (client) => serviceMember(client, app, workspace), evidenceRefs: input.evidence_refs, appSubject: app,
          respond: async (client) => dto(await read(client, app, subject, workspace, id)),
        });
      }
      return withTransaction(pool, async (client) => {
        await client.query('SELECT id FROM core.workflow_instances WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [workspace, id]);
        const row = await read(client, app, subject, workspace, id);
        const actor = await authorize(client, subject, workspace, [], true);
        if (input.evidence_refs.length || input.owner_subject !== undefined) throw new ApiError(422, 'INVALID_WORKFLOW_INPUT', 'Document workflow does not accept owner or evidence references');
        const current = { state: row.to_state, owner_subject: row.owner_subject, version: row.version };
        const next = createWorkflowEngine(row.definition).transition(current, input, { subject, roles: actor.roles }, {});
        await appendHistory(client, workspace, id, next, subject, input.action, input.reason, current.state);
        await audit(client, app, subject, workspace, id, 'workflow.transitioned', next);
        await authorize(client, subject, workspace, [], true);
        return dto(await read(client, app, subject, workspace, id));
      });
    },
  };
}
