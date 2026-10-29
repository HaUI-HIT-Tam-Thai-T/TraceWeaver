// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { casefold } from './casefold.js';

export const FEATURE_VERSION = 'sandbox-observable-features-2';
const strong = new Set(['request', 'account', 'job']);
const transitions = new Set([
  JSON.stringify(['intake', 'request.accepted', 'account', 'account.created']),
  JSON.stringify(['account', 'account.created', 'provision', 'provision.completed']),
  JSON.stringify(['account', 'account.created', 'provision', 'provision.failed']),
]);
const tokens = (value) => new Set(casefold(value.replaceAll('[REDACTED]', ' ').normalize('NFKC')).match(/[\p{L}\p{N}_]+/gu) ?? []);
function micros(value) {
  return BigInt(Date.parse(`${value.slice(0, 19)}Z`)) * 1000n
    + BigInt((value.includes('.') ? value.slice(20, -1) : '').padEnd(6, '0').slice(0, 6));
}

// Inputs have already been normalized, redacted and validated by BE ingestion.
// These observable flags describe the pair; outcome/ACL/ambiguity stay in BE guards.
export function extractPairFeatures(a, b) {
  const ids = (event) => event.identifiers.filter((id) => !id.value.includes('[REDACTED]'));
  const left = ids(a), right = ids(b);
  const xIds = new Set(left.map((id) => JSON.stringify([id.namespace, id.value])));
  const yIds = new Set(right.map((id) => JSON.stringify([id.namespace, id.value])));
  const x = tokens(a.message), y = tokens(b.message);
  const intersection = [...x].filter((word) => y.has(word)).length;
  return {
    delta_seconds: Number(micros(b.occurred_at) - micros(a.occurred_at)) / 1e6,
    shared_id_count: [...xIds].filter((id) => yIds.has(id)).length,
    text_similarity: x.size && y.size ? intersection / (x.size + y.size - intersection) : 0,
    transition_allowed: transitions.has(JSON.stringify([a.service, a.action, b.service, b.action])),
    conflicting_id: left.some((id) => strong.has(id.namespace)
      && right.some((other) => other.namespace === id.namespace && other.value !== id.value)),
  };
}

export { extractPairFeatures as pairFeatures };
