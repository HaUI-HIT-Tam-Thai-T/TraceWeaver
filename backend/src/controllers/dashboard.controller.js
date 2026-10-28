// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { workspaceId } from '../validations/access.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function createDashboardController(dashboard) {
  return async (req, res) => {
    const workspace = workspaceId(req.params.wid);
    if (!dashboard) throw new ApiError(503, 'CORE_NOT_READY', 'Dashboard is temporarily unavailable');
    res.json(await dashboard.get(req.identity.subject, workspace, req.query));
  };
}
