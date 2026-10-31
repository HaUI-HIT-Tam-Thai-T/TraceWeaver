// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { withTransaction } from '../data/database.js';
import { authorize } from '../identity/workspace-access.js';
import { reader } from '../identity/access-repository.js';
import { ApiError } from '../identity/api-error.js';
import { createWorkflow, appendHistory, historyDto } from './store.js';
import { createWorkflowEngine } from './engine.js';

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
const key = (definition, version, type) => JSON.stringify([definition, version, type]);
function dto(row) {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    definition_key: row.definition_key,
    definition_version: row.definition_version,
    entity_ref: { type: row.entity_type, id: row.entity_id },
    state: row.to_state,
    owner_subject: row.owner_subject,
    version: row.version,
    history: row.history.map(historyDto),
  };
}

// Register trusted definitions and application adapters at composition time, never from request bodies.
export function createWorkflowRepository(pool, { definitions = [], adapters = [] } = {}) {
  const registry = new Map();
  for (const { definition, entityType, createRoles } of definitions) {
    const snapshot = createWorkflowEngine(definition).snapshot();
    const id = key(snapshot.key, snapshot.version, entityType);
    const allowedCreators = createRoles ?? [
      ...new Set(
        Object.values(snapshot.transitions)
          .filter((rule) => rule.from.includes(snapshot.initial))
          .flatMap((rule) => rule.roles),
      ),
    ];
    if (
      typeof entityType !== 'string' ||
      !entityType ||
      registry.has(id) ||
      !Array.isArray(allowedCreators) ||
      !allowedCreators.length ||
      allowedCreators.some((role) => typeof role !== 'string' || !role.trim())
    )
      throw new Error('Invalid workflow registration');
    registry.set(id, { definition: snapshot, createRoles: [...allowedCreators] });
  }
  for (const adapter of adapters) {
    const id = key(adapter.definitionKey, adapter.definitionVersion, adapter.entityType);
    if (
      !adapter.definitionKey ||
      !Number.isSafeInteger(adapter.definitionVersion) ||
      adapter.definitionVersion < 1 ||
      !adapter.entityType ||
      registry.has(id) ||
      !['authorizeRead', 'create', 'transition'].every(
        (method) => typeof adapter[method] === 'function',
      )
    ) {
      throw new Error('Invalid workflow adapter');
    }
    registry.set(id, { adapter });
  }
  async function serviceMember(client, app, workspace) {
    const { rowCount } = await client.query(
      'SELECT 1 FROM core.memberships WHERE workspace_id=$1 AND subject=$2 AND revoked_at IS NULL',
      [workspace, app],
    );
    if (!rowCount) throw notFound();
  }
  async function read(client, app, subject, workspace, id) {
    await serviceMember(client, app, workspace);
    await authorize(client, subject, workspace, []);
    const {
      rows: [row],
    } = await client.query(
      `SELECT i.*,h.to_state,h.owner_subject,h.version,
      ARRAY(SELECT to_jsonb(wh) FROM core.workflow_history wh WHERE wh.workspace_id=i.workspace_id AND wh.instance_id=i.id ORDER BY version) AS history
      FROM core.workflow_instances i
      JOIN LATERAL (SELECT * FROM core.workflow_history h WHERE h.workspace_id=i.workspace_id AND h.instance_id=i.id ORDER BY version DESC LIMIT 1) h ON true
      WHERE i.workspace_id=$2 AND i.id=$3 AND ${reader}
      AND EXISTS(SELECT 1 FROM core.memberships sm WHERE sm.workspace_id=i.workspace_id AND sm.subject=$4 AND sm.revoked_at IS NULL)`,
      [subject, workspace, id, app],
    );
    if (!row) throw notFound();
    const registration = registry.get(
      key(row.definition_key, row.definition_version, row.entity_type),
    );
    if (!registration) throw notFound();
    if (registration.adapter)
      await registration.adapter.authorizeRead(client, { app, subject, workspace, row });
    return row;
  }
  async function audit(client, app, subject, workspace, id, action, state) {
    await client.query(
      `INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,after_ref)
      VALUES($1,$2,$3,$4,'workflow_instance',$5,$6)`,
      [
        randomUUID(),
        workspace,
        subject,
        action,
        id,
        { app_subject: app, state: state.state, version: state.version },
      ],
    );
  }
  async function authorizeCreate(client, subject, workspace, registration) {
    const actor = await authorize(client, subject, workspace, []);
    if (!actor.roles.some((role) => registration.createRoles.includes(role))) {
      throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
    }
    return actor;
  }
  return {
    create(app, subject, workspace, input) {
      return withTransaction(pool, async (client) => {
        await serviceMember(client, app, workspace);
        await authorize(client, subject, workspace, []);
        const registration = registry.get(
          key(input.definition_key, input.definition_version, input.entity_ref.type),
        );
        if (!registration)
          throw new ApiError(
            422,
            'INVALID_DEFINITION',
            'Workflow definition, version or entity type is not supported',
          );
        if (registration.adapter)
          return registration.adapter.create(client, { app, subject, workspace, input });
        await authorizeCreate(client, subject, workspace, registration);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          JSON.stringify([workspace, input.entity_ref.type, input.entity_ref.id]),
        ]);
        const { rowCount } = await client.query(
          'SELECT 1 FROM core.workflow_instances WHERE workspace_id=$1 AND entity_type=$2 AND entity_id=$3',
          [workspace, input.entity_ref.type, input.entity_ref.id],
        );
        if (rowCount) throw new ApiError(409, 'WORKFLOW_EXISTS', 'Entity already has a workflow');
        const id = randomUUID();
        const history = await createWorkflow(client, {
          id,
          workspace,
          creator: subject,
          entity: input.entity_ref,
          definition: registration.definition,
        });
        await audit(client, app, subject, workspace, id, 'workflow.created', {
          state: history.to_state,
          version: 1,
        });
        await authorizeCreate(client, subject, workspace, registration);
        return dto(await read(client, app, subject, workspace, id));
      });
    },
    async get(app, subject, workspace, id) {
      return dto(await read(pool, app, subject, workspace, id));
    },
    async transition(app, subject, workspace, id, input) {
      const initial = await read(pool, app, subject, workspace, id);
      const registration = registry.get(
        key(initial.definition_key, initial.definition_version, initial.entity_type),
      );
      if (registration.adapter) {
        return registration.adapter.transition({
          app,
          subject,
          workspace,
          row: initial,
          input,
          serviceMember: (client) => serviceMember(client, app, workspace),
          respond: async (client) => dto(await read(client, app, subject, workspace, id)),
        });
      }
      return withTransaction(pool, async (client) => {
        await client.query(
          'SELECT id FROM core.workflow_instances WHERE workspace_id=$1 AND id=$2 FOR UPDATE',
          [workspace, id],
        );
        const row = await read(client, app, subject, workspace, id);
        const actor = await authorize(client, subject, workspace, []);
        if (input.evidence_refs.length || input.owner_subject !== undefined)
          throw new ApiError(
            422,
            'INVALID_WORKFLOW_INPUT',
            'Document workflow does not accept owner or evidence references',
          );
        const current = {
          state: row.to_state,
          owner_subject: row.owner_subject,
          version: row.version,
        };
        const engine = createWorkflowEngine(row.definition);
        const next = engine.transition(current, input, { subject, roles: actor.roles }, {});
        await appendHistory(
          client,
          workspace,
          id,
          next,
          subject,
          input.action,
          input.reason,
          current.state,
        );
        await audit(client, app, subject, workspace, id, 'workflow.transitioned', next);
        const latestActor = await authorize(client, subject, workspace, []);
        engine.authorize(current, input.action, { subject, roles: latestActor.roles });
        return dto(await read(client, app, subject, workspace, id));
      });
    },
  };
}
