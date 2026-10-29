// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { ApiError } from '../core/identity/api-error.js';

export function labCommand(body) {
  const fields = { capacity: ['ram'], submit: ['ram', 'request_id'], provision: ['request_id', 'operation_id'],
    image: ['request_id', 'image_id', 'available'], account: ['request_id', 'account_id', 'active'] };
  const required = body && Object.hasOwn(fields, body.action) ? ['action', 'expected_version', ...fields[body.action]] : null;
  const optional = body?.action === 'submit' ? ['image_available', 'account_active'] : [];
  const invalid = () => { throw new ApiError(400, 'INVALID_INPUT', 'Invalid sandbox command'); };
  if (!required || Array.isArray(body) || required.some(k => !Object.hasOwn(body, k)) ||
      Object.keys(body).some(k => !required.includes(k) && !optional.includes(k)) ||
      !Number.isSafeInteger(body.expected_version) || body.expected_version < 1) invalid();
  for (const key of ['request_id', 'operation_id', 'image_id', 'account_id'])
    if (Object.hasOwn(body, key) && (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 220 || body[key].includes('\u0000') || !body[key].isWellFormed())) invalid();
  if (body.request_id?.length > 200 || body.operation_id?.length > 200) invalid();
  if (Object.hasOwn(body, 'ram') && (!Number.isSafeInteger(body.ram) || body.ram < (body.action === 'submit' ? 1 : 0) || body.ram > 1048576)) invalid();
  for (const key of ['available', 'active', ...optional]) if (Object.hasOwn(body, key) && typeof body[key] !== 'boolean') invalid();
  return body;
}
