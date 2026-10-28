// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { dashboardQuery } from '../validations/dashboard.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function createDashboardService(repository) {
  return {
    async get(subject, workspace, query) {
      const filters = dashboardQuery(query);
      try { return await repository.get(subject, workspace, filters); }
      catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, 'CORE_NOT_READY', 'Dashboard is temporarily unavailable');
      }
    },
  };
}
