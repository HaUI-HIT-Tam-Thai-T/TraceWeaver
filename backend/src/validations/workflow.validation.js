// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { redactText } from '../core/data/event-normalizer.js';
import { ApiError } from '../core/identity/api-error.js';
const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
const validators = Object.fromEntries(['WorkflowCreate', 'WorkflowTransition'].map((name) => [name, ajv.getSchema(`${schema.$id}#/$defs/${name}`)]));
export function workflowInput(kind, body, subject, workspace) {
  const fail = () => new ApiError(422, 'INVALID_WORKFLOW_INPUT', 'Workflow input does not match the contract');
  if (!validators[kind]?.(body)) throw fail();
  try {
    const value = structuredClone(body);
    if (kind === 'WorkflowCreate') {
      value.workspace_id = value.workspace_id.toLowerCase(); value.entity_ref.id = value.entity_ref.id.toLowerCase();
      if (value.creator_subject !== subject || value.workspace_id !== workspace) throw fail();
    } else {
      value.reason = redactText(value.reason);
      value.evidence_refs = value.evidence_refs.map((id) => id.toLowerCase()).sort();
      if (value.evidence_refs.length > 1000 || new Set(value.evidence_refs).size !== value.evidence_refs.length) throw fail();
      if (value.owner_subject !== undefined && (value.action !== 'assign' || !value.owner_subject.trim() ||
        value.owner_subject.includes('\u0000') || !value.owner_subject.isWellFormed())) throw fail();
    }
    if (!validators[kind](value)) throw fail();
    return value;
  } catch { throw fail(); }
}
