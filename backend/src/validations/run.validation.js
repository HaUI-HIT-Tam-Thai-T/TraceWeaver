// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { ApiError } from '../core/identity/api-error.js';
import { createCandidateGenerator } from '../core/reconstruction/candidates.js';
import { sandboxRulePolicy } from '../core/reconstruction/policy.js';
const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
const validate = ajv.getSchema(`${schema.$id}#/$defs/RunCreate`);
const checkWindow = createCandidateGenerator(sandboxRulePolicy());

export function runInput(body) {
  if (!validate(body)) throw new ApiError(422, 'INVALID_RUN_INPUT', 'Run input does not match the contract');
  const input = { root_event_id: body.root_event_id.toLowerCase(),
    source_ids: body.source_ids.map((id) => id.toLowerCase()).sort(), window: { ...body.window }, mode: body.mode };
  if (new Set(input.source_ids).size !== input.source_ids.length) throw new ApiError(422, 'INVALID_RUN_INPUT', 'Source IDs must be unique');
  // Reuse exact core window bounds; an empty event set should only fail the root check.
  try { checkWindow({ ...input, events: [] }); } catch (error) { if (error.status !== 404) throw error; }
  return input;
}

export function idempotencyKey(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must contain 1 to 200 visible ASCII characters');
  }
  return value;
}
