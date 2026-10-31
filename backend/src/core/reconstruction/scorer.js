// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { pairFeatures } from './features.js';
import { SANDBOX_MODEL_VERSION } from './scorer-model.js';
export { FEATURE_VERSION, pairFeatures, extractPairFeatures } from './features.js';

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(schema);
const valid = ajv.getSchema(`${schema.$id}#/$defs/ScoreResponse`);

// Receives only already scoped, guard-approved links. Never breaks ambiguity with scores.
export function createScorer({
  scorerUrl,
  scorerSecret,
  scorerTimeoutMs = 5000,
  scorerModelVersion = '',
} = {}) {
  return async (links, events) => {
    if (!scorerUrl || !scorerSecret) throw new Error('ai_unavailable');
    if (scorerModelVersion !== '' && scorerModelVersion !== SANDBOX_MODEL_VERSION)
      throw new Error('ai_incompatible_model');
    if (!links.length) throw new Error('ai_no_eligible_pairs');
    const signal = AbortSignal.timeout(Math.min(scorerTimeoutMs, 5000)),
      byId = new Map(events.map((e) => [e.event_id, e]));
    const scores = new Map();
    let version, method;
    for (let offset = 0; offset < links.length; offset += 100) {
      const pairs = links.slice(offset, offset + 100).map((link, i) => ({
        pair_id: String(offset + i),
        features: pairFeatures(byId.get(link.from_event_id), byId.get(link.to_event_id)),
      }));
      const response = await fetch(scorerUrl, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerSecret}` },
        body: JSON.stringify({ schema_version: '1', pairs }),
      });
      if (!response.ok) throw new Error('ai_unavailable');
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        await response.body?.cancel();
        throw new Error('ai_invalid_response');
      }
      const kind = response.headers.get('x-scorer-method');
      const expectedMethod = scorerModelVersion ? 'model' : 'rule';
      if (kind !== expectedMethod) {
        await response.body?.cancel();
        throw new Error('ai_incompatible_model');
      }
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1048576) throw new Error('ai_invalid_response');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new Error('ai_invalid_response');
      }
      const expected = new Set(pairs.map((p) => p.pair_id));
      if (
        !valid(body) ||
        body.predictions.length !== pairs.length ||
        body.predictions.some((p) => !expected.delete(p.pair_id)) ||
        expected.size ||
        body.model_version !== (scorerModelVersion || 'baseline-rule-v1') ||
        (version && (version !== body.model_version || method !== kind))
      )
        throw new Error('ai_invalid_response');
      version = body.model_version;
      method = kind;
      for (const p of body.predictions) scores.set(Number(p.pair_id), p.score);
    }
    return { scores, version, method };
  };
}

export async function annotateRun(result, events, mode, scorer) {
  const state = {
    model_version: null,
    effective_method: 'rule_only',
    degraded: mode === 'hybrid',
    degraded_reason: mode === 'hybrid' ? 'ai_unavailable' : null,
  };
  if (mode !== 'hybrid') return state;
  try {
    const scored = await scorer(result.links, events);
    result.links = result.links.map((link, i) => ({ ...link, score: scored.scores.get(i) }));
    return scored.method === 'model'
      ? {
          model_version: scored.version,
          effective_method: 'hybrid',
          degraded: false,
          degraded_reason: null,
        }
      : { ...state, model_version: scored.version, degraded_reason: 'ai_baseline_only' };
  } catch (error) {
    const allowed = [
      'ai_unavailable',
      'ai_no_eligible_pairs',
      'ai_incompatible_model',
      'ai_invalid_response',
    ];
    return {
      ...state,
      degraded_reason: ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'ai_timeout'
        : allowed.includes(error.message)
          ? error.message
          : 'ai_unavailable',
    };
  }
}
