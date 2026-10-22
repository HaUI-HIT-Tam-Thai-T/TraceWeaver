// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { ApiError } from '../identity/api-error.js';

const ajv = new Ajv2020({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
const validates = (name) => ajv.getSchema(`${schema.$id}#/$defs/${name}`);
const validRun = validates('RunCreate'), validEvent = validates('Event'), validTime = validates('UtcTime');
const badInput = () => new ApiError(400, 'INVALID_RUN_INPUT', 'Reconstruction input is invalid');
const tooLarge = () => new ApiError(422, 'WINDOW_TOO_LARGE', 'Run window exceeds supported bounds');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const stage = ({ service, action }) => JSON.stringify([service, action]);
const closed = (value, fields) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every((key) => fields.includes(key));
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  && value.isWellFormed() && !value.includes('\u0000');
const bounded = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

export function compileRulePolicy(policy) {
  const invalid = () => { throw new TypeError('Invalid reconstruction rule policy'); };
  if (!closed(policy, ['version', 'strong_namespaces', 'clock_skew_ms', 'transitions']) || !text(policy.version, 100)
      || !bounded(policy.clock_skew_ms, 5000) || !Array.isArray(policy.strong_namespaces)
      || !policy.strong_namespaces.length || !policy.strong_namespaces.every((name) => text(name, 100))
      || new Set(policy.strong_namespaces).size !== policy.strong_namespaces.length
      || !Array.isArray(policy.transitions) || !policy.transitions.length) invalid();
  const ids = new Set(), paths = new Set();
  for (const rule of policy.transitions) {
    if (!closed(rule, ['id', 'from', 'to', 'max_gap_ms', 'allow_fan_in', 'allow_fan_out']) || !text(rule.id, 100)
        || !bounded(rule.max_gap_ms, 3600000) || ![rule.from, rule.to].every((value) =>
          closed(value, ['service', 'action']) && text(value.service, 100) && text(value.action, 200))
        || ['allow_fan_in', 'allow_fan_out'].some((key) => rule[key] !== undefined && typeof rule[key] !== 'boolean')) invalid();
    const path = JSON.stringify([stage(rule.from), stage(rule.to)]);
    if (ids.has(rule.id) || paths.has(path)) invalid();
    ids.add(rule.id); paths.add(path);
  }
  return structuredClone(policy);
}

// Preserve arbitrary RFC3339 fractional precision; Date alone would truncate to milliseconds.
function instant(value) {
  if (!validTime(value) || value.startsWith('0000-')) throw badInput();
  const seconds = Date.parse(`${value.slice(0, 19)}Z`) / 1000;
  if (!Number.isSafeInteger(seconds)) throw badInput();
  return { seconds: BigInt(seconds), fraction: value.includes('.') ? value.slice(20, -1) : '' };
}
function order(a, b) {
  const width = Math.max(a.fraction.length, b.fraction.length);
  return compare(a.seconds, b.seconds) || compare(a.fraction.padEnd(width, '0'), b.fraction.padEnd(width, '0'));
}
function shift(point, milliseconds) {
  const width = Math.max(point.fraction.length, 3), scale = 10n ** BigInt(width);
  const ticks = point.seconds * scale + BigInt(point.fraction.padEnd(width, '0'))
    + BigInt(milliseconds) * (scale / 1000n);
  let seconds = ticks / scale, remainder = ticks % scale;
  if (remainder < 0n) { seconds -= 1n; remainder += scale; }
  return { seconds, fraction: remainder.toString().padStart(width, '0') };
}
function identifiers(event, namespaces) {
  const values = new Map();
  for (const { namespace, value } of event.identifiers) {
    if (!namespaces.has(namespace) || value.includes('[REDACTED]')) continue;
    if (!values.has(namespace)) values.set(namespace, new Set());
    values.get(namespace).add(value);
  }
  return values;
}
function evidence(reason_code, from, to, field, observed_values) {
  return { reason_code, event_ids: [from, to], field, observed_values };
}

export function createCandidateGenerator(configuration) {
  const policy = compileRulePolicy(configuration), namespaces = new Set(policy.strong_namespaces);
  return function generate({ events, root_event_id, source_ids, window }) {
    if (!Array.isArray(events) || !validRun({ root_event_id, source_ids, window, mode: 'rule_only' })) throw badInput();
    const start = instant(window.from), end = instant(window.to);
    if (order(start, end) > 0) throw badInput();
    if (order(end, shift(start, 3600000)) > 0) throw tooLarge();
    const sources = new Set(source_ids.map((value) => value.toLowerCase()));
    const scoped = [], seen = new Set();
    for (const event of events) {
      // Source filtering happens before reading any other fields from an invisible event.
      if (typeof event?.source_id !== 'string' || !sources.has(event.source_id.toLowerCase())) continue;
      const at = instant(event.occurred_at);
      if (order(at, start) < 0 || order(at, end) > 0) continue;
      if (!validEvent(event)) throw badInput();
      const id = event.event_id.toLowerCase();
      if (seen.has(id)) throw badInput();
      seen.add(id);
      scoped.push({ id, at, occurred_at: event.occurred_at, stage: stage(event), ids: identifiers(event, namespaces) });
      if (scoped.length > 1000) throw tooLarge();
    }
    const root = root_event_id.toLowerCase();
    if (!seen.has(root)) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
    scoped.sort((a, b) => compare(a.id, b.id));
    const groups = new Map();
    for (const event of scoped) {
      if (!groups.has(event.stage)) groups.set(event.stage, []);
      groups.get(event.stage).push(event);
    }
    const candidates = [], rejected_counts = {};
    for (const rule of [...policy.transitions].sort((a, b) => compare(a.id, b.id))) {
      for (const from of groups.get(stage(rule.from)) ?? []) {
        for (const to of groups.get(stage(rule.to)) ?? []) {
          if (from.id === to.id) continue;
          if (order(to.at, shift(from.at, -policy.clock_skew_ms)) < 0
              || order(to.at, shift(from.at, rule.max_gap_ms)) > 0) continue;
          // Same-stage retries must advance time; skew cannot create a reverse retry.
          if (from.stage === to.stage && order(from.at, to.at) >= 0) continue;
          const shared = [], conflicts = [];
          for (const namespace of [...namespaces].sort(compare)) {
            const a = from.ids.get(namespace), b = to.ids.get(namespace);
            if (!a || !b) continue;
            if (a.size !== 1 || b.size !== 1 || [...a][0] !== [...b][0]) conflicts.push(namespace);
            else shared.push([namespace, [...a][0]]);
          }
          if (conflicts.length) {
            rejected_counts.STRONG_ID_CONFLICT = (rejected_counts.STRONG_ID_CONFLICT ?? 0) + 1;
            continue;
          }
          candidates.push({ transition_id: rule.id, from_event_id: from.id, to_event_id: to.id,
            has_strong_id: shared.length > 0,
            evidence: [evidence('TRANSITION_MATCH', from.id, to.id, 'service/action',
              [rule.from.service, rule.from.action, rule.to.service, rule.to.action]),
              evidence('TIME_WINDOW', from.id, to.id, 'occurred_at', [from.occurred_at, to.occurred_at]),
              ...shared.map(([namespace, value]) => evidence('SHARED_STRONG_ID', from.id, to.id, `identifiers.${namespace}`, [value]))] });
        }
      }
    }
    return { rule_version: policy.version, root_event_id: root, event_ids: scoped.map((event) => event.id), candidates, rejected_counts };
  };
}
