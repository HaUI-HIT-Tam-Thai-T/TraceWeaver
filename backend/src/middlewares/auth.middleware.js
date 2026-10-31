// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../core/identity/api-error.js';

export function authenticateAccessToken(verifyToken, access) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (
      typeof header !== 'string' ||
      header.length > 16384 ||
      !/^Bearer [A-Za-z0-9_.-]+$/i.test(header)
    ) {
      throw new ApiError(401, 'INVALID_TOKEN', 'A valid Bearer access token is required');
    }
    if (!verifyToken || !access)
      throw new ApiError(
        503,
        'IDENTITY_UNAVAILABLE',
        'Identity verification is temporarily unavailable',
      );
    req.identity = await verifyToken(header.slice(7));
    next();
  };
}
