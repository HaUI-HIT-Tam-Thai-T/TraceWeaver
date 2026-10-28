// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { eventQuery } from '../validations/event.validation.js';
import { workspaceId } from '../validations/access.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function createEventController(events) {
  const available = () => { if (!events) throw new ApiError(503, 'CORE_NOT_READY', 'Core is temporarily unavailable'); };
  return {
    async list(req, res) {
      const query = eventQuery(req.query), workspace = workspaceId(req.params.wid);
      available();
      res.json(await events.page(req.identity.subject, workspace, query));
    },
    async detail(req, res) {
      if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_QUERY', 'Event query parameters are invalid');
      const workspace = workspaceId(req.params.wid), event = workspaceId(req.params.eid);
      available();
      res.json(await events.detail(req.identity.subject, workspace, event));
    },
  };
}
