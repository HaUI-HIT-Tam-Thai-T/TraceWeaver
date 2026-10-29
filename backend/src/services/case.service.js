// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { caseInput } from '../validations/case.validation.js';
import { idempotencyKey } from '../validations/run.validation.js';
import { digest } from '../core/data/event-normalizer.js';
export function createCaseService(repository, access, cursors) {
  async function protect(work) {
    try { return await work(); } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'CORE_NOT_READY', 'Case management is temporarily unavailable');
    }
  }
  return {
    verifications(subject, workspace, id) { return protect(() => repository.verifications(subject, workspace, id)); },
    verify(subject, workspace, id) { return protect(() => repository.verify(subject, workspace, id)); },
    create(subject, workspace, input, key) {
      return protect(() => repository.create(subject, workspace, caseInput('CaseCreate', input), idempotencyKey(key)));
    },
    get(subject, workspace, id) { return protect(() => repository.get(subject, workspace, id)); },
    assignees(subject, workspace, id) { return protect(() => repository.assignees(subject, workspace, id)); },
    evidence(subject, workspace, id, input) {
      return protect(() => repository.evidence(subject, workspace, id, caseInput('EvidenceCreate', input)));
    },
    transition(subject, workspace, id, input, key) {
      return protect(() => repository.transition(subject, workspace, id, caseInput('CaseTransition', input), idempotencyKey(key)));
    },
    page(subject, workspace, { state, owner_id, limit, cursor, from, to }) {
      return protect(async () => {
        const [membership] = await access.memberships(subject, workspace);
        if (!membership) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
        if (!membership.roles.some((role) => ['viewer', 'operator', 'reviewer', 'admin'].includes(role))) throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
        const context = { kind: 'cases', subject, workspace, state, owner_id, limit, from: from ?? '', to: to ?? '', scope: digest(membership), sort: 'id_asc' };
        const last = cursor ? cursors.decode(cursor, context) : null;
        const rows = await repository.list(subject, workspace, last, limit + 1, state, owner_id, { from, to }), items = rows.slice(0, limit);
        return { items, next_cursor: rows.length > limit ? cursors.encode(context, items.at(-1).id) : null };
      });
    },
  };
}
