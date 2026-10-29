// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto';
import { createLab, changeCapacity, submitRequest, provision, inspectRequest } from '../../../../simulator/lab-state.mjs';
import { withTransaction } from './database.js';
import { authorize } from './run-repository.js';
import { ApiError } from '../identity/api-error.js';

export function createLabRepository(pool) {
  async function access(client, subject, workspace, sources, admin = false, write = false) {
    const actor = await authorize(client, subject, workspace, sources, write);
    if (admin && !actor.roles.includes('admin')) throw new ApiError(403, 'FORBIDDEN', 'Workspace administrator required');
    return actor;
  }
  async function locked(client, subject, workspace, admin, write) {
    const { rows: [row] } = await client.query('SELECT * FROM core.lab_sandboxes WHERE workspace_id=$1 FOR UPDATE', [workspace]);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Sandbox not configured');
    await access(client, subject, workspace, row.source_ids, admin, write);
    return row;
  }
  async function save(client, subject, workspace, before, after, action) {
    await client.query('UPDATE core.lab_sandboxes SET document=$2,updated_at=clock_timestamp() WHERE workspace_id=$1', [workspace, after]);
    await client.query(`INSERT INTO core.audit_events(id,workspace_id,actor_subject,action,entity_type,entity_id,before_ref,after_ref)
      VALUES($1,$2,$3,$4,'lab_sandbox',$7,$5,$6)`, [randomUUID(), workspace, subject, action,
      before ? { version: before.version } : null, { version: after.version }, workspace]);
  }
  return {
    configure(subject, workspace, sourceIds, ram = 2) {
      return withTransaction(pool, async client => {
        if (!Array.isArray(sourceIds) || sourceIds.length !== 3 || new Set(sourceIds).size !== 3) throw new ApiError(400, 'INVALID_SOURCES', 'Three distinct sources required');
        await access(client, subject, workspace, sourceIds, true);
        const { rows } = await client.query('SELECT service FROM core.sources WHERE workspace_id=$1 AND id=ANY($2::uuid[])', [workspace, sourceIds]);
        if (new Set(rows.map(r => r.service)).size !== 3 || !rows.every(r => ['intake', 'account', 'provision'].includes(r.service))) throw new ApiError(400, 'INVALID_SOURCES', 'Intake, account and provision sources required');
        const state = createLab({ ram });
        const result = await client.query('INSERT INTO core.lab_sandboxes(workspace_id,source_ids,document) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [workspace, sourceIds, state]);
        if (!result.rowCount) throw new ApiError(409, 'SANDBOX_EXISTS', 'Sandbox already configured');
        await save(client, subject, workspace, null, state, 'lab.configured');
        return state;
      });
    },
    read(subject, workspace) {
      return withTransaction(pool, async client => (await locked(client, subject, workspace, false, false)).document);
    },
    command(subject, workspace, command) {
      return withTransaction(pool, async client => {
        const row = await locked(client, subject, workspace, command.action === 'capacity', command.action !== 'capacity');
        let next;
        try {
          if (command.action === 'capacity') next = changeCapacity(row.document, command.ram, command.expected_version);
          else if (command.action === 'submit') {
            if (command.expected_version !== row.document.version) throw new Error('VERSION_CONFLICT');
            next = submitRequest(row.document, { id: command.request_id, ram: command.ram });
          } else if (command.action === 'provision') next = provision(row.document, command.request_id,
            { expectedVersion: command.expected_version, operationId: command.operation_id });
          else throw new Error('INVALID_ACTION');
        } catch (error) {
          throw new ApiError(error.message === 'VERSION_CONFLICT' ? 409 : 422, 'LAB_COMMAND_REJECTED', error.message);
        }
        if (next.version !== row.document.version) {
          await save(client, subject, workspace, row.document, next, `lab.${command.action}`);
          const records = [];
          const identifiers = [{ namespace: 'request', value: command.request_id }];
          const account = `lab-account-${command.request_id}`;
          const at = new Date().toISOString();
          if (command.action === 'submit') {
            records.push({ service: 'intake', action: 'request.accepted', outcome: 'success', identifiers, payload: { requested_ram_gb: command.ram } });
            records.push({ service: 'account', action: 'account.created', outcome: 'success', identifiers: [...identifiers, { namespace: 'account', value: account }], payload: {} });
          }
          if (command.action === 'provision') {
            const request = next.requests.find(r => r.id === command.request_id), attempt = request.attempts.at(-1);
            records.push({ service: 'provision', action: attempt.result === 'passed' ? 'provision.completed' : 'provision.failed',
              outcome: attempt.result === 'passed' ? 'success' : 'failed', identifiers: [...identifiers, { namespace: 'account', value: account }],
              payload: { attempt_id: attempt.id, attempt: attempt.number, required_ram_gb: attempt.required_ram, available_ram_gb: attempt.available_ram,
                reason: attempt.reason, environment: request.environment, sandbox: true } });
          }
          for (const record of records) {
            const { rows: [source] } = await client.query('SELECT id FROM core.sources WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND service=$3', [workspace, row.source_ids, record.service]);
            const eventId = randomUUID();
            const document = { ...record, source_event_id: eventId, occurred_at: at, message: `[Sandbox] ${command.request_id}: ${record.action}` };
            await client.query('INSERT INTO core.lab_outbox(id,workspace_id,source_id,document) VALUES($1,$2,$3,$4)', [eventId, workspace, source.id, document]);
          }
        }
        return next;
      });
    },
    inspect(subject, workspace, requestId) {
      return withTransaction(pool, async client => {
        const row = await locked(client, subject, workspace, false, false);
        try { return inspectRequest(row.document, requestId); }
        catch { throw new ApiError(404, 'NOT_FOUND', 'Request not found'); }
      });
    },
  };
}
