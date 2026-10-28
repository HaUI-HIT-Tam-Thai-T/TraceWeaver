// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from '../validations/access.validation.js';
import { caseQuery } from '../validations/case.validation.js';
export function createCaseController(cases) {
  function scope(req, list = false) {
    if (!list && Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Case query parameters are invalid');
    if (req.method === 'POST' && !req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    const workspace = workspaceId(req.params.wid);
    if (!cases) throw new ApiError(503, 'CORE_NOT_READY', 'Case management is temporarily unavailable');
    return workspace;
  }
  return {
    async create(req, res) {
      const workspace = scope(req), result = await cases.create(req.identity.subject, workspace, req.body, req.get('Idempotency-Key'));
      res.location(`/api/v1/workspaces/${workspace}/cases/${result.id}`).status(201).json(result);
    },
    async list(req, res) {
      const workspace = scope(req, true);
      res.json(await cases.page(req.identity.subject, workspace, caseQuery(req.query)));
    },
    async get(req, res) {
      const workspace = scope(req);
      res.json(await cases.get(req.identity.subject, workspace, workspaceId(req.params.cid)));
    },
    async evidence(req, res) {
      const workspace = scope(req);
      res.status(201).json(await cases.evidence(req.identity.subject, workspace, workspaceId(req.params.cid), req.body));
    },
    async transition(req, res) {
      const workspace = scope(req);
      res.json(await cases.transition(req.identity.subject, workspace, workspaceId(req.params.cid), req.body, req.get('Idempotency-Key')));
    },
  };
}
