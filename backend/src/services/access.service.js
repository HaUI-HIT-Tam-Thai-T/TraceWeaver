// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { ApiError } from '../core/identity/api-error.js';

const readerRoles = new Set(['viewer', 'operator', 'reviewer', 'admin']);
export function createAccessService(repository, cursors) {
  async function db(work) {
    try { return await work(); } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Core is temporarily unavailable');
    }
  }
  return {
    async me(subject) {
      return { subject, memberships: (await db(() => repository.memberships(subject))).map(({ source_ids, ...membership }) => membership) };
    },
    async page(kind, subject, workspace, { limit, cursor, q }) {
      return db(async () => {
        const [membership] = await repository.memberships(subject, workspace);
        if (!membership) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
        if (!membership.roles.some((role) => readerRoles.has(role))) throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
        const scope = createHash('sha256').update(JSON.stringify(membership)).digest('hex');
        const context = { kind, subject, workspace, q, scope, sort: 'id_asc' };
        const last = cursor ? cursors.decode(cursor, context) : null;
        const rows = await (kind === 'sources' ? repository.sources(subject, workspace, last, limit + 1)
          : repository.knowledge(subject, workspace, last, limit + 1, q));
        const items = rows.slice(0, limit);
        return { items, next_cursor: rows.length > limit ? cursors.encode(context, items.at(-1).id) : null };
      });
    },
  };
}
