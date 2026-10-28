// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';

export function queryParams(query, kind) {
  const allowed = new Set(['limit', 'cursor', ...(kind === 'knowledge' ? ['q'] : [])]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || typeof value !== 'string') throw new ApiError(400, 'INVALID_QUERY', 'Query parameters are invalid');
  }
  const limit = query.limit ?? '50';
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100 ||
      (query.q !== undefined && (!query.q.length || query.q.length > 500)) ||
      (query.cursor !== undefined && (!query.cursor.length || query.cursor.length > 4096))) {
    throw new ApiError(400, 'INVALID_QUERY', 'Query parameters are invalid');
  }
  return { limit: Number(limit), cursor: query.cursor, q: query.q ?? '' };
}

export function workspaceId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'INVALID_QUERY', 'Workspace ID is invalid');
  }
  return value.toLowerCase();
}
