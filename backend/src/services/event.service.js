// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { ApiError } from '../core/identity/api-error.js';
const readerRoles = new Set(['viewer', 'operator', 'reviewer', 'admin']);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Resource not found');
export function createEventService(repository, accessRepository, cursors) {
  async function protect(work) {
    try { return await work(); } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Core is temporarily unavailable');
    }
  }
  async function membership(subject, workspace) {
    const [current] = await accessRepository.memberships(subject, workspace);
    if (!current) throw notFound();
    if (!current.roles.some((role) => readerRoles.has(role))) throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
    return current;
  }
  return {
    page(subject, workspace, filters) {
      return protect(async () => {
        const current = await membership(subject, workspace);
        if (filters.source_id && !current.source_ids.includes(filters.source_id)) throw notFound();
        const { cursor, ...query } = filters;
        const context = { kind: 'events', subject, workspace, scope: hash(current), filters: hash(query), sort: 'occurred_at,event_id' };
        const last = cursor ? cursors.decode(cursor, context) : null;
        const snapshot = last?.snapshot ?? await repository.snapshot();
        const rows = await repository.page(subject, workspace, current.source_ids, filters, snapshot, last);
        const visible = rows.slice(0, filters.limit), tail = visible.at(-1);
        return { items: visible.map((row) => row.event), next_cursor: rows.length > filters.limit
          ? cursors.encode(context, { snapshot, occurred_at: tail.occurred_at, event_id: tail.event.event_id }) : null };
      });
    },
    detail(subject, workspace, id) {
      return protect(async () => {
        const current = await membership(subject, workspace);
        const event = await repository.detail(subject, workspace, current.source_ids, id);
        if (!event) throw notFound();
        return event;
      });
    },
  };
}
