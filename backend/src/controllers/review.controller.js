// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from '../validations/access.validation.js';
export function createReviewController(reviews) {
  function scope(req) {
    if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Link query parameters are invalid');
    if (!req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    const ids = [workspaceId(req.params.wid), workspaceId(req.params.rid)];
    if (!reviews) throw new ApiError(503, 'CORE_NOT_READY', 'Link editing is temporarily unavailable');
    return ids;
  }
  return {
    async review(req, res) {
      const [workspace, run] = scope(req), link = workspaceId(req.params.lid);
      res.status(201).json(await reviews.review(req.identity.subject, workspace, run, link, req.body));
    },
    async manual(req, res) {
      const [workspace, run] = scope(req);
      res.status(201).json(await reviews.manual(req.identity.subject, workspace, run, req.body));
    },
  };
}
