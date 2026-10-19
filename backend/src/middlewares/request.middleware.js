// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.set('X-Request-ID', req.requestId);
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
}
