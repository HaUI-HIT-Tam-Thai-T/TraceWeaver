// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { eventQuery } from './event.validation.js';
import { ApiError } from '../core/identity/api-error.js';
export function dashboardQuery(query) {
  for (const [key, value] of Object.entries(query)) {
    if (!['from', 'to'].includes(key) || typeof value !== 'string' || value.length > 128) {
      throw new ApiError(400, 'INVALID_QUERY', 'Dashboard time filters are invalid');
    }
  }
  eventQuery(query);
  return { ...query };
}
