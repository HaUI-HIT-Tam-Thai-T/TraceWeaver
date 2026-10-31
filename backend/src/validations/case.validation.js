// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { redactText } from '../core/data/event-normalizer.js';
import { ApiError } from '../core/identity/api-error.js';
import { queryParams } from './access.validation.js';
import { dashboardQuery } from './dashboard.validation.js';
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(schema);
const validators = Object.fromEntries(
  ['CaseCreate', 'EvidenceCreate', 'CaseTransition', 'CaseState'].map((name) => [
    name,
    ajv.getSchema(`${schema.$id}#/$defs/${name}`),
  ]),
);
export function caseInput(kind, body) {
  const fail = () =>
    new ApiError(422, 'INVALID_CASE_INPUT', 'Case input does not match the contract');
  if (!validators[kind]?.(body)) throw fail();
  try {
    const value = { ...body };
    for (const key of ['title', 'note', 'reason'])
      if (key in value) value[key] = redactText(value[key]);
    if (value.title !== undefined && !value.title.trim()) throw fail();
    if (
      value.owner_id !== undefined &&
      (value.owner_id.includes('\u0000') ||
        !value.owner_id.isWellFormed() ||
        !value.owner_id.trim() ||
        value.action !== 'assign')
    )
      throw fail();
    if (value.run_id) value.run_id = value.run_id.toLowerCase();
    if (value.event_ids) {
      value.event_ids = value.event_ids.map((id) => id.toLowerCase()).sort();
      if (value.event_ids.length > 1000 || new Set(value.event_ids).size !== value.event_ids.length)
        throw fail();
    }
    if (!validators[kind](value)) throw fail();
    return value;
  } catch {
    throw fail();
  }
}
export function caseQuery(query) {
  const { state = '', owner_id = '', from, to, ...page } = query;
  const filters = dashboardQuery({
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });
  const base = queryParams(page, 'cases');
  if (
    typeof state !== 'string' ||
    (state && !validators.CaseState(state)) ||
    typeof owner_id !== 'string' ||
    owner_id.length > 255 ||
    owner_id.includes('\u0000') ||
    !owner_id.isWellFormed() ||
    (query.owner_id !== undefined && !owner_id.trim()) ||
    (query.state !== undefined && !state)
  ) {
    throw new ApiError(400, 'INVALID_QUERY', 'Case query parameters are invalid');
  }
  return { limit: base.limit, cursor: base.cursor, state, owner_id, ...filters };
}
