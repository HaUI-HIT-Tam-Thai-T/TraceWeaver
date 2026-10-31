// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { workspaceId } from '../validations/access.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function createIngestionController(ingestion) {
  return async (req, res) => {
    if (Object.keys(req.query).length)
      throw new ApiError(400, 'INVALID_QUERY', 'Query parameters are invalid');
    if (!req.is('application/json'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON body is required');
    if (!ingestion) throw new ApiError(503, 'CORE_NOT_READY', 'Core is temporarily unavailable');
    res.json(
      await ingestion.batch(
        req.identity.subject,
        workspaceId(req.params.wid),
        workspaceId(req.params.sid),
        req.body,
      ),
    );
  };
}
