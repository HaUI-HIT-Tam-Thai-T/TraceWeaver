// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { ApiError } from '../core/identity/api-error.js';
import { workspaceId } from './access.validation.js';
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(schema);
export const validUtcTime = ajv.getSchema(`${schema.$id}#/$defs/UtcTime`);
const invalid = () => new ApiError(400, 'INVALID_QUERY', 'Event query parameters are invalid');
function laterThan(a, b) {
  const delta = Date.parse(a) - Date.parse(b);
  if (delta !== 0) return delta > 0;
  const fraction = (value) => value.split('.')[1]?.slice(0, -1) ?? '';
  const x = fraction(a),
    y = fraction(b),
    width = Math.max(x.length, y.length);
  return x.padEnd(width, '0') > y.padEnd(width, '0');
}
export function eventQuery(query) {
  const allowed = new Set(['limit', 'cursor', 'source_id', 'from', 'to', 'q', 'action']);
  for (const [key, value] of Object.entries(query)) {
    if (
      !allowed.has(key) ||
      typeof value !== 'string' ||
      !value.length ||
      value.includes('\u0000') ||
      !value.isWellFormed()
    )
      throw invalid();
  }
  const limit = query.limit ?? '50';
  if (
    !/^\d+$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 100 ||
    (query.cursor?.length ?? 0) > 4096 ||
    (query.q?.length ?? 0) > 500 ||
    (query.action?.length ?? 0) > 200
  )
    throw invalid();
  for (const key of ['from', 'to'])
    if (
      query[key] &&
      (!validUtcTime(query[key]) ||
        query[key].startsWith('0000-') ||
        !Number.isFinite(Date.parse(query[key])))
    )
      throw invalid();
  if (query.from && query.to && laterThan(query.from, query.to)) throw invalid();
  return {
    limit: Number(limit),
    cursor: query.cursor,
    source_id: query.source_id ? workspaceId(query.source_id) : '',
    from: query.from ?? '',
    to: query.to ?? '',
    q: query.q ?? '',
    action: query.action ?? '',
  };
}
