// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from '../validations/access.validation.js';
export function createRunController(runs) {
  const check = (req) => {
    if (Object.keys(req.query).length)
      throw new ApiError(400, 'INVALID_QUERY', 'Run query parameters are invalid');
    if (!runs)
      throw new ApiError(503, 'CORE_NOT_READY', 'Reconstruction is temporarily unavailable');
    return workspaceId(req.params.wid);
  };
  return {
    async create(req, res) {
      const workspace = check(req);
      if (!req.is('application/json'))
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
      const run = await runs.create(
        req.identity.subject,
        workspace,
        req.body,
        req.get('Idempotency-Key'),
      );
      res.location(`/api/v1/workspaces/${workspace}/runs/${run.id}`).status(202).json(run);
    },
    async get(req, res) {
      const workspace = check(req),
        id = workspaceId(req.params.rid);
      res.json(await runs.get(req.identity.subject, workspace, id));
    },
    async graph(req, res) {
      const workspace = check(req),
        id = workspaceId(req.params.rid);
      res.json(await runs.get(req.identity.subject, workspace, id, true));
    },
  };
}
