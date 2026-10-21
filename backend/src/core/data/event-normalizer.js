// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { validEvent } from '../../validations/ingestion.validation.js';

const secretKey = /password|passwd|secret|token|authorization|cookie|api[_-]?key|credential/i;
function text(value) {
  if (value.includes('\u0000') || !value.isWellFormed()) throw new Error('unsupported text');
  return value.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(password|passwd|secret|token|api[_-]?key|authorization|cookie)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1=[REDACTED]');
}
function redact(value, depth = 0) {
  if (depth > 32) throw new Error('depth');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number');
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => {
      if (key.includes('\u0000') || !key.isWellFormed()) throw new Error('unsupported key');
      return [key, secretKey.test(key) ? '[REDACTED]' : redact(entry, depth + 1)];
    }));
  return value;
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex');

export function normalizeEvent(input, source) {
  if (!validEvent(input)) return { code: 'INVALID_EVENT' };
  if (input.service !== source.service) return { code: 'SOURCE_SERVICE_MISMATCH' };
  if (!['intake', 'account', 'provision'].includes(source.service) || source.parser_version !== `${source.service}-v1`) return { code: 'UNSUPPORTED_PARSER' };
  try {
    const event = redact(input);
    // Source identity is opaque; never alter it during normalization.
    event.source_event_id = input.source_event_id;
    event.occurred_at = new Date(input.occurred_at).toISOString();
    const { payload, ...fields } = event;
    const normalized = { ...fields, payload_redacted: payload, parser_version: source.parser_version };
    return { event: normalized, hash: digest(normalized) };
  } catch { return { code: 'INVALID_EVENT' }; }
}
