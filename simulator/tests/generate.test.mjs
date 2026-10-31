// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { generateDataset, scenarioKinds } from '../generate.mjs';

test('same seed/config reproduces bytes; different seed changes observable identities', () => {
  const a = generateDataset();
  assert.deepEqual(a, generateDataset());
  assert.notEqual(
    a.events[0].source_event_id,
    generateDataset({ seed: 'another-seed' }).events[0].source_event_id,
  );
  assert.equal(a.scenarios.length, 36);
  assert.deepEqual(new Set(a.scenarios.map((s) => s.kind)), new Set(scenarioKinds));
  assert.equal(new Set(a.events.map((e) => e.source_event_id)).size, a.events.length);
});

test('observable records conform to ingestion contract and contain no oracle labels', () => {
  const schema = JSON.parse(
    readFileSync(new URL('../../backend/contracts/schemas/domain.schema.json', import.meta.url)),
  );
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  ajv.addSchema(schema);
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/EventInput` });
  const d = generateDataset();
  for (const event of d.events) {
    assert.ok(validate(event), JSON.stringify(validate.errors));
    assert.doesNotMatch(
      JSON.stringify(event),
      /expected_edges|ground_truth|oracle|scenario_kind|is_decoy/,
    );
    assert.ok(event.message.includes('[Mô phỏng]'));
  }
  for (const s of d.scenarios) {
    assert.ok(Date.parse(s.window.from) <= Date.parse(s.window.to));
    assert.ok(Date.parse(s.window.to) - Date.parse(s.window.from) < 3600000);
    for (const id of s.event_ids) {
      const e = d.events.find((e) => e.source_event_id === id);
      assert.ok(
        e &&
          Date.parse(e.occurred_at) >= Date.parse(s.window.from) &&
          Date.parse(e.occurred_at) <= Date.parse(s.window.to),
      );
    }
  }
});

test('delivery duplicates, conflicts and late arrival are distinct from unique event truth', () => {
  const d = generateDataset({ count: 12 });
  const duplicate = d.deliveries.find((x) => x.expected_status === 'duplicate');
  assert.deepEqual(
    duplicate.event,
    d.events.find((e) => e.source_event_id === duplicate.event.source_event_id),
  );
  const conflict = d.deliveries.find((x) => x.expected_status === 'rejected');
  assert.notDeepEqual(
    conflict.event,
    d.events.find((e) => e.source_event_id === conflict.event.source_event_id),
  );
  const late = d.scenarios.find((s) => s.kind === 'late_log');
  const account = late.event_ids.find(
    (id) => d.events.find((e) => e.source_event_id === id).service === 'account',
  );
  const provision = late.event_ids.find(
    (id) => d.events.find((e) => e.source_event_id === id).service === 'provision',
  );
  assert.ok(
    d.deliveries.findIndex((x) => x.event.source_event_id === account) >
      d.deliveries.findIndex((x) => x.event.source_event_id === provision),
  );
  const ids = new Set(d.events.map((e) => e.source_event_id));
  for (const edge of d.oracle.expected_edges) assert.ok(ids.has(edge.from) && ids.has(edge.to));
});

test('rejects invalid sizes and timestamps before generating data', () => {
  for (const count of [0, -1, 1.5, 10001]) assert.throws(() => generateDataset({ count }));
  assert.throws(() => generateDataset({ baseTime: 'invalid' }));
  assert.throws(() => generateDataset({ seed: '' }));
});
