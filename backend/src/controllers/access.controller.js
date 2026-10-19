// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { queryParams, workspaceId } from '../validations/access.validation.js';

export function createAccessController(access) {
  const read = (kind) => async (req, res) => {
    res.json(await access.page(kind, req.identity.subject, workspaceId(req.params.wid), queryParams(req.query, kind)));
  };
  return {
    async me(req, res) {
      if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Query parameters are invalid');
      res.json(await access.me(req.identity.subject));
    },
    sources: read('sources'), knowledge: read('knowledge'),
  };
}
