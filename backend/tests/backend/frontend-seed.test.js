// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import test from 'node:test';
import assert from 'node:assert/strict';
import { frontendDemo, demoTag } from '../../scripts/seed-frontend-demo.js';
import { normalizeEvent } from '../../src/core/data/event-normalizer.js';
import { createRuleEngine } from '../../src/core/reconstruction/rules.js';
import { sandboxRulePolicy } from '../../src/core/reconstruction/policy.js';

test('frontend fixtures pass real ingestion normalization and cover baseline and degraded scenarios', () => {
  const scenarios = frontendDemo('2026-10-27T03:00:00Z');
  const reconstruct = createRuleEngine(sandboxRulePolicy());
  const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  assert.equal(scenarios.length, 12);
  assert.equal(scenarios.flatMap((scenario) => scenario.events).length, 36);
  assert.equal(new Set(scenarios.flatMap((scenario) => scenario.events.map((event) => event.source_event_id))).size, 36);
  assert.deepEqual(scenarios, frontendDemo('2026-10-27T03:00:00Z'));
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
    assert.ok(scenario.title.includes(demoTag));
  }
});
