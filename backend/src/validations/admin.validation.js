// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { ApiError } from '../core/identity/api-error.js';
const roles = new Set(['viewer', 'operator', 'reviewer', 'admin']);
export const adminInvalid = () => { throw new ApiError(400, 'INVALID_INPUT', 'Invalid administration input'); };
export function adminSubject(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 255 || value.includes('\u0000') || !value.isWellFormed()) adminInvalid();
  return value;
}
export function adminInput(kind, body) {
  const fields = { add: ['subject', 'roles', 'expected_version'], member: ['roles', 'active', 'expected_version'],
    source: ['enabled', 'expected_version'], account: ['username', 'temporary_password', 'roles', 'expected_version'] }[kind];
  if (!body || Array.isArray(body) || !fields || Object.keys(body).length !== fields.length ||
      fields.some(k => !Object.hasOwn(body, k)) || !Number.isSafeInteger(body.expected_version) || body.expected_version < 1) adminInvalid();
  if (fields.includes('subject')) adminSubject(body.subject);
  if (fields.includes('roles') && (!Array.isArray(body.roles) || !body.roles.length || body.roles.length > 4 ||
      new Set(body.roles).size !== body.roles.length || body.roles.some(r => !roles.has(r)))) adminInvalid();
  for (const k of ['active', 'enabled']) if (fields.includes(k) && typeof body[k] !== 'boolean') adminInvalid();
  if (kind === 'account' && (typeof body.username !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(body.username) ||
      typeof body.temporary_password !== 'string' || body.temporary_password.length < 12 || body.temporary_password.length > 128 ||
      body.temporary_password.includes('\u0000') || !body.temporary_password.isWellFormed())) adminInvalid();
  return body;
}
