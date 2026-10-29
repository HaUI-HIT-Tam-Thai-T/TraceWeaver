// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createScorer, pairFeatures, annotateRun } from '../../src/core/reconstruction/scorer.js';
import { sandboxRulePolicy } from '../../src/core/reconstruction/policy.js';
import { createRuleEngine } from '../../src/core/reconstruction/rules.js';
import { pythonScorer } from '../support/python-scorer.js';

const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = (n, service, action, outcome = 'success') => ({ event_id: id(n), source_id: id(900),
  source_event_id: String(n), occurred_at: `2026-10-28T00:00:0${n}.000001Z`, received_at: '2026-10-28T00:01:00Z',
  service, action, outcome, identifiers: [{ namespace: 'request', value: 'R1' }], message: 'Lab ready',
  payload_redacted: {}, parser_version: 'test-1', provenance: { batch_id: id(901), locator: 'line:1', sha256_redacted: 'a'.repeat(64) } });
const events = [event(1, 'intake', 'request.accepted'), event(2, 'account', 'account.created'), event(3, 'provision', 'provision.failed', 'failed')];
const input = { events, root_event_id: id(1), source_ids: [id(900)], window: { from: '2026-10-28T00:00:00Z', to: '2026-10-28T00:01:00Z' } };
const engine = createRuleEngine(sandboxRulePolicy());
async function server(t, handler) {
  const instance = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    await handler(req, res, JSON.parse(raw));
  });
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => { instance.closeAllConnections(); instance.close(); });
  return `http://127.0.0.1:${instance.address().port}/internal/v1/score-pairs`;
}
function reply(res, request, patch = {}, method = 'rule') {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Scorer-Method', method);
  res.end(JSON.stringify({ model_version: 'baseline-rule-v1', feature_schema_version: '1',
    predictions: request.pairs.map((p) => ({ pair_id: p.pair_id, score: 0.8 })), ...patch }));
}
test('outcome policy rejects unknown/mismatch including root; failed provision remains eligible', () => {
  assert.equal(engine(input).links.length, 2);
  for (const outcome of ['unknown', 'failed']) {
    const changed = structuredClone(input); changed.events[0].outcome = outcome;
    const result = engine(changed);
    assert.equal(result.links.length, 0);
    assert.equal(result.abstentions[0].event_id, id(1));
    assert.equal(result.abstentions[0].reason_code, outcome === 'unknown' ? 'OUTCOME_UNKNOWN' : 'OUTCOME_ACTION_MISMATCH');
  }
});

const modelVersion = 'logistic-regression-sandbox-features-2-experiment-1';
test('trained v2 requires explicit opt-in and annotates only pending rule-derived links', async (t) => {
  const url = await server(t, (req, res, body) => reply(res, body, { model_version: modelVersion }, 'model'));
  const config = { scorerUrl: url, scorerSecret: 's'.repeat(32) };
  const disabled = engine(input);
  assert.equal((await annotateRun(disabled, events, 'hybrid', createScorer(config))).degraded_reason, 'ai_incompatible_model');
  assert.ok(disabled.links.every((link) => link.score === null));
  const result = engine(input), before = structuredClone(result.links);
  const state = await annotateRun(result, events, 'hybrid', createScorer({ ...config, scorerModelVersion: modelVersion }));
  assert.equal(state.model_version, modelVersion); assert.equal(state.effective_method, 'hybrid');
  assert.equal(state.degraded, false); assert.equal(state.degraded_reason, null);
  assert.deepEqual(result.links, before.map((link) => ({ ...link, score: 0.8 })));
});

test('trained batches map reversed pair IDs and reject changed models/methods without partial scores', async (t) => {
  for (const scenario of ['success', 'version', 'method', 'missing', 'extra']) {
    let count = 0;
    const url = await server(t, (req, res, body) => {
      assert.ok(body.pairs.length <= 100); count++;
      const predictions = body.pairs.map((pair) => ({ pair_id: pair.pair_id, score: Number(pair.pair_id) / 500 })).reverse();
      if (count === 2 && scenario === 'missing') predictions.pop();
      if (count === 2 && scenario === 'extra') predictions.push({ pair_id: 'unrequested', score: 1 });
      reply(res, body, { model_version: count === 2 && scenario === 'version' ? 'unreviewed' : modelVersion, predictions },
        count === 2 && scenario === 'method' ? 'rule' : 'model');
    });
    const result = engine(input);
    result.links = Array.from({ length: 201 }, () => ({ ...result.links[0] }));
    const state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: url,
      scorerSecret: 's'.repeat(32), scorerModelVersion: modelVersion }));
    if (scenario === 'success') {
      assert.equal(count, 3); assert.equal(state.degraded, false);
      assert.deepEqual(result.links.map((link) => link.score), Array.from({ length: 201 }, (_, i) => i / 500));
    } else {
      assert.equal(count, 2); assert.equal(state.model_version, null); assert.equal(state.effective_method, 'rule_only');
      assert.ok(result.links.every((link) => link.score === null));
    }
  }
});

test('real trained Python model annotates BE features; stopped scorer falls back and cannot change guard decisions',
  { skip: !process.env.SCORER_PYTHON }, async (t) => {
  const python = await pythonScorer(t, { model: true });
  const scorer = createScorer(python), result = engine(input), before = structuredClone(result.links);
  const state = await annotateRun(result, events, 'hybrid', scorer);
  assert.equal(state.model_version, modelVersion); assert.equal(state.effective_method, 'hybrid');
  assert.equal(state.degraded, false); assert.equal(state.degraded_reason, null);
  assert.deepEqual(result.links.map(({ score, ...link }) => link), before.map(({ score, ...link }) => link));
  assert.ok(result.links.every((link) => Number.isFinite(link.score) && link.score >= 0 && link.score <= 1));
  for (const change of ['unknown', 'conflict', 'ambiguous', 'missing_strong_id']) {
    const changed = structuredClone(input);
    if (change === 'unknown') changed.events[0].outcome = 'unknown';
    if (change === 'conflict') changed.events[1].identifiers[0].value = 'OTHER';
    if (change === 'ambiguous') changed.events.push({ ...changed.events[1], event_id: id(4) });
    if (change === 'missing_strong_id') changed.events.forEach((event) => { event.identifiers = [{ namespace: 'user', value: 'same-user' }]; });
    const guarded = engine(changed);
    assert.equal(guarded.links.length, 0);
    assert.equal((await annotateRun(guarded, changed.events, 'hybrid', scorer)).degraded_reason, 'ai_no_eligible_pairs');
  }
  await python.stop();
  const fallback = engine(input), failed = await annotateRun(fallback, events, 'hybrid', scorer);
  assert.equal(failed.degraded_reason, 'ai_unavailable'); assert.equal(failed.model_version, null);
  assert.deepEqual(fallback.links, before);
});

test('trained batches share one total deadline rather than resetting the budget per batch', async (t) => {
  let count = 0;
  const url = await server(t, async (req, res, body) => {
    count++;
    await new Promise((resolve) => setTimeout(resolve, 90));
    reply(res, body, { model_version: modelVersion }, 'model');
  });
  const result = engine(input);
  result.links = Array.from({ length: 101 }, () => ({ ...result.links[0] }));
  const state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: url,
    scorerSecret: 's'.repeat(32), scorerModelVersion: modelVersion, scorerTimeoutMs: 150 }));
  assert.equal(count, 2); assert.equal(state.degraded_reason, 'ai_timeout');
  assert.equal(state.model_version, null); assert.ok(result.links.every((link) => link.score === null));
});
test('features preserve microseconds, namespaces, dedup and redact sentinel; Unicode Jaccard is deterministic', () => {
  const a = structuredClone(events[0]), b = structuredClone(events[1]);
  a.identifiers.push({ namespace: 'user', value: 'U1' }, { namespace: 'request', value: 'R1' }, { namespace: 'job', value: '[REDACTED]' });
  b.identifiers.push({ namespace: 'user', value: 'U1' }, { namespace: 'job', value: '[REDACTED]' });
  a.message = 'ＡBC café'; b.message = 'abc café x'; b.occurred_at = '2026-10-28T00:00:01.000002Z';
  assert.deepEqual(pairFeatures(a, b), { delta_seconds: 0.000001, shared_id_count: 2, text_similarity: 2 / 3,
    transition_allowed: true, conflicting_id: false });
});
test('real HTTP sends numeric features only and annotates pending links honestly as baseline', async (t) => {
  const url = await server(t, (req, res, body) => {
    assert.equal(req.headers.authorization, `Bearer ${'s'.repeat(32)}`);
    assert.deepEqual(Object.keys(body.pairs[0]), ['pair_id', 'features']); reply(res, body);
  });
  const result = engine(input), state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: url, scorerSecret: 's'.repeat(32) }));
  assert.equal(state.degraded_reason, 'ai_baseline_only'); assert.equal(state.effective_method, 'rule_only');
  assert.equal(state.model_version, 'baseline-rule-v1');
  assert.ok(result.links.every((l) => l.method === 'rule' && l.score === 0.8 && l.review_state === 'pending'));
});
test('malformed sets, out of range scores, unavailable and incompatible model discard scores', async (t) => {
  for (const scenario of ['duplicate', 'range', 'unavailable', 'model', 'schema']) {
    const url = await server(t, (req, res, body) => {
      if (scenario === 'unavailable') { res.writeHead(503); res.end(); return; }
      if (scenario === 'model') { reply(res, body, { model_version: 'unknown-model' }); return; }
      if (scenario === 'schema') { reply(res, body, { feature_schema_version: '2' }); return; }
      reply(res, body, { predictions: body.pairs.map((p, i) => ({ pair_id: scenario === 'duplicate' ? '0' : p.pair_id, score: scenario === 'range' ? 2 : 0.8 })) });
    });
    const result = engine(input), state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: url, scorerSecret: 's'.repeat(32) }));
    assert.equal(state.model_version, null); assert.ok(state.degraded); assert.ok(result.links.every((l) => l.score === null));
  }
});
test('shared deadline covers response body; failure after first batch never leaves partial scores', async (t) => {
  let count = 0;
  const url = await server(t, (req, res, body) => {
    assert.ok(body.pairs.length <= 100);
    if (++count === 1) reply(res, body); else { res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Scorer-Method', 'rule'); res.writeHead(200); res.flushHeaders(); }
  });
  const result = engine(input); result.links = Array.from({ length: 101 }, () => ({ ...result.links[0] }));
  const state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: url, scorerSecret: 's'.repeat(32), scorerTimeoutMs: 100 }));
  assert.equal(count, 2); assert.equal(state.degraded_reason, 'ai_timeout'); assert.ok(result.links.every((l) => l.score === null));
});
test('scorer is never invoked in rule-only mode or for ambiguous pairs', async () => {
  const result = engine(input);
  const state = await annotateRun(result, events, 'rule_only', () => { throw new Error('must not run'); });
  assert.equal(state.degraded, false);
  const changed = structuredClone(input); changed.events.push({ ...events[1], event_id: id(4) });
  assert.equal(engine(changed).links.length, 0);
});

test('Node runtime features reach the real Python baseline over HTTP', { skip: !process.env.SCORER_PYTHON }, async (t) => {
  const secret = 'integration-only-secret-32-characters';
  // Bind an ephemeral port in the child, avoiding fixed-port collisions.
  const script = `import socket,uvicorn\nfrom ai.app.api import create_app\nfrom ai.app.config import Config\ns=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1],flush=True)\nuvicorn.Server(uvicorn.Config(create_app(Config(service_secret='${secret}',mode='baseline')),log_level='error')).run(sockets=[s])`;
  const child = spawn(process.env.SCORER_PYTHON, ['-c', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const port = await new Promise((resolve, reject) => {
    child.stdout.once('data', (chunk) => resolve(Number(chunk.toString().trim())));
    child.once('error', reject); child.once('exit', (code) => reject(new Error(`Python exited ${code}`)));
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health/ready`)).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'Python scorer becomes ready');
  const result = engine(input);
  const state = await annotateRun(result, events, 'hybrid', createScorer({ scorerUrl: `${base}/internal/v1/score-pairs`, scorerSecret: secret }));
  assert.equal(state.model_version, 'baseline-rule-v1'); assert.equal(state.degraded_reason, 'ai_baseline_only');
  assert.ok(result.links.every((link) => Number.isFinite(link.score) && link.review_state === 'pending'));
});
