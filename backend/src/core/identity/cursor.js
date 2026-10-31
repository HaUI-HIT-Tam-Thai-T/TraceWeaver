// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './api-error.js';

export function createCursorCodec(secret) {
  if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('CURSOR_SECRET must contain at least 32 characters');
  const sign = (data) => createHmac('sha256', secret).update(data).digest();
  return {
    encode(context, last) {
      const data = Buffer.from(JSON.stringify({ v: 1, ...context, last })).toString('base64url');
      return `${data}.${sign(data).toString('base64url')}`;
    },
    decode(cursor, context) {
      try {
        if (
          typeof cursor !== 'string' ||
          cursor.length > 4096 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)
        )
          throw new Error();
        const parts = cursor.split('.');
        if (parts.length !== 2) throw new Error();
        const actual = Buffer.from(parts[1], 'base64url');
        if (actual.toString('base64url') !== parts[1]) throw new Error();
        const expected = sign(parts[0]);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
          throw new Error();
        const decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        if (
          decoded.v !== 1 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.last)
        )
          throw new Error();
        for (const [name, value] of Object.entries(context))
          if (decoded[name] !== value) throw new Error();
        return decoded.last;
      } catch {
        throw new ApiError(
          400,
          'INVALID_CURSOR',
          'Cursor no longer matches the request or permissions',
        );
      }
    },
  };
}
