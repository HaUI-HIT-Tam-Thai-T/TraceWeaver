// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './api-error.js';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validPosition(value) {
  return (
    value &&
    typeof value.snapshot === 'string' &&
    /^\d+:\d+:(?:\d+(?:,\d+)*)?$/.test(value.snapshot) &&
    typeof value.occurred_at === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value.occurred_at) &&
    Number.isFinite(Date.parse(value.occurred_at)) &&
    uuid.test(value.event_id)
  );
}
export function createEventCursorCodec(secret) {
  if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('CURSOR_SECRET must contain at least 32 characters');
  const sign = (value) => createHmac('sha256', secret).update(`events-v1:${value}`).digest();
  return {
    encode(context, position) {
      if (!validPosition(position)) throw new Error('Invalid event cursor position');
      const data = Buffer.from(JSON.stringify({ v: 1, context: hash(context), position })).toString(
        'base64url',
      );
      const cursor = `${data}.${sign(data).toString('base64url')}`;
      if (cursor.length > 4096)
        throw new ApiError(
          503,
          'SNAPSHOT_UNAVAILABLE',
          'Event snapshot is temporarily unavailable',
        );
      return cursor;
    },
    decode(cursor, context) {
      try {
        if (
          typeof cursor !== 'string' ||
          cursor.length > 4096 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)
        )
          throw new Error();
        const [data, signature] = cursor.split('.'),
          bytes = Buffer.from(data, 'base64url'),
          actual = Buffer.from(signature, 'base64url');
        if (
          bytes.toString('base64url') !== data ||
          actual.toString('base64url') !== signature ||
          actual.length !== 32 ||
          !timingSafeEqual(actual, sign(data))
        )
          throw new Error();
        const decoded = JSON.parse(bytes.toString('utf8'));
        if (
          decoded.v !== 1 ||
          decoded.context !== hash(context) ||
          !validPosition(decoded.position)
        )
          throw new Error();
        return decoded.position;
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
