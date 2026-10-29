// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { ApiError } from '../core/identity/api-error.js';

export function browserCors(origins) {
  const allowed = new Set(origins), methods = new Set(['GET', 'POST', 'OPTIONS']);
  const headers = new Set(['authorization', 'content-type', 'idempotency-key']);
  return (req, res, next) => {
    const origin = req.get('Origin');
    if (!origin) return next();
    res.vary('Origin');
    if (!allowed.has(origin)) throw new ApiError(403, 'CORS_FORBIDDEN', 'Browser origin is not allowed');
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Expose-Headers', 'Location, X-Request-ID, Retry-After');
    if (req.method !== 'OPTIONS') return next();
    const method = req.get('Access-Control-Request-Method');
    const requested = (req.get('Access-Control-Request-Headers') ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!methods.has(method) || requested.some((x) => !headers.has(x))) {
      throw new ApiError(403, 'CORS_FORBIDDEN', 'Browser preflight is not allowed');
    }
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.status(204).end();
  };
}
