// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { ApiError } from '../core/identity/api-error.js';
import { redactText } from '../core/data/event-normalizer.js';
const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
const validators = Object.fromEntries(['ReviewCreate', 'ManualLinkCreate'].map((name) => [name, ajv.getSchema(`${schema.$id}#/$defs/${name}`)]));
function input(name, body) {
  if (!validators[name](body)) throw new ApiError(422, 'INVALID_LINK_INPUT', 'Link input does not match the contract');
  try { return { ...body, reason: redactText(body.reason) }; }
  catch { throw new ApiError(422, 'INVALID_LINK_INPUT', 'Reason contains unsupported text'); }
}
export const reviewInput = (body) => input('ReviewCreate', body);
export function manualLinkInput(body) {
  const value = input('ManualLinkCreate', body);
  value.from_event_id = value.from_event_id.toLowerCase(); value.to_event_id = value.to_event_id.toLowerCase();
  if (value.from_event_id === value.to_event_id) throw new ApiError(422, 'SELF_LINK', 'A link must connect different events');
  return value;
}
