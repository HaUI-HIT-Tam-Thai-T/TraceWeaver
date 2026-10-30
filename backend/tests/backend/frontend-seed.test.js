// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import test from 'node:test';
import assert from 'node:assert/strict';
import { frontendDemo, demoTag } from '../../scripts/seed-frontend-demo.js';
import { labDemo, labDemoTag } from '../../scripts/seed-lab-demo.js';
import { normalizeEvent } from '../../src/core/data/event-normalizer.js';
import { createRuleEngine } from '../../src/core/reconstruction/rules.js';
import { sandboxRulePolicy } from '../../src/core/reconstruction/policy.js';

for (const [generate, tag] of [[frontendDemo, demoTag], [labDemo, labDemoTag]]) test(`${tag} passes real ingestion normalization and covers baseline and degraded scenarios`, () => {
  const scenarios = generate('2026-10-28T03:00:00Z');
  const reconstruct = createRuleEngine(sandboxRulePolicy());
  const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  assert.equal(scenarios.length, 12);
  assert.equal(scenarios.flatMap((scenario) => scenario.events).length, 36);
  assert.equal(new Set(scenarios.flatMap((scenario) => scenario.events.map((event) => event.source_event_id))).size, 36);
  assert.deepEqual(scenarios, generate('2026-10-28T03:00:00Z'));
  assert.equal(scenarios.filter((scenario) => scenario.mode === 'hybrid').length, 4);
  for (const state of ['new', 'assigned', 'investigating', 'awaiting_verification']) assert.equal(scenarios.filter((scenario) => scenario.state === state).length, 3);
  for (const [index, scenario] of scenarios.entries()) {
    const sourceIds = [id(100), id(101), id(102)];
    const events = scenario.events.map((event, step) => {
      const normalized = normalizeEvent(event, { service: event.service, parser_version: `${event.service}-v1` });
      assert.ok(normalized.event, `${event.source_event_id}: ${normalized.code}`);
      return { ...normalized.event, event_id: id(step + 1), source_id: sourceIds[['intake', 'account', 'provision'].indexOf(event.service)],
        received_at: event.occurred_at, provenance: { batch_id: id(200), locator: `line:${step + 1}`, sha256_redacted: normalized.hash } };
    });
    const graph = reconstruct({ root_event_id: events[0].event_id, source_ids: sourceIds, mode: scenario.mode, window: scenario.window, events });
    assert.equal(graph.links.length, index % 4 === 3 ? 0 : index % 4 === 2 ? 1 : 2);
    assert.equal(graph.unresolved_event_ids.length, index % 4 === 3 ? 3 : 0);
    assert.ok(scenario.title.includes(tag === demoTag ? demoTag : 'LAB-20261028-'));
    if (tag === labDemoTag) {
      assert.ok(scenario.title.startsWith('[Demo]'));
      for (const event of scenario.events) {
        assert.equal(event.payload.demo, true);
        assert.equal(event.payload.dataset, labDemoTag);
        assert.ok(event.message.includes('[Demo]'));
        assert.ok(new Date(event.occurred_at) >= new Date(scenario.window.from));
        assert.ok(new Date(event.occurred_at) <= new Date(scenario.window.to));
        assert.ok(!event.message.includes('FE-DEMO'));
      }
      if (index % 4 === 2) assert.equal(scenario.events.some((event) => event.service === 'provision'), false);
      if (index % 4 === 3) assert.ok(scenario.events.slice(1).every((event) => event.identifiers.length === 0));
    }
  }
});

test('lab fixtures distinguish actual step results and specific provisioning failures', () => {
  const scenarios = labDemo('2026-10-28T03:00:00Z');
  const failures = scenarios.flatMap((scenario) => scenario.events).filter((event) => event.outcome === 'failed');
  assert.deepEqual(failures.map((event) => event.payload.error_code), ['CAPACITY_EXHAUSTED', 'IMAGE_PULL_TIMEOUT', 'NETWORK_ALLOCATION_FAILED']);
  for (const scenario of scenarios) {
    assert.equal(scenario.events[0].outcome, 'success');
    assert.equal(scenario.events[1].outcome, 'success');
    assert.ok(!scenario.events[0].message.includes('thất bại'));
  }
  assert.throws(() => labDemo('invalid'));
});
