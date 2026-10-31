// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
import { caseFixture } from '../support/case-fixture.js';
import { createIngestionService } from '../../src/services/ingestion.service.js';
import { createIngestionRepository } from '../../src/core/data/ingestion-repository.js';
import { createEventRepository } from '../../src/core/data/event-repository.js';
import { eventQuery } from '../../src/validations/event.validation.js';

test('audit ingestion fixes preserve Event contracts, microsecond identity and exact SQL bounds', async (t) => {
  const f = await caseFixture(t),
    { pool, workspace, sources } = f;
  const ingest = createIngestionService(createIngestionRepository(pool)),
    events = createEventRepository(pool);
  const input = (id, occurred_at, patch = {}) => ({
    source_event_id: id,
    occurred_at,
    service: 'intake',
    action: 'request.accepted',
    outcome: 'success',
    identifiers: [],
    message: '',
    payload: {},
    ...patch,
  });
  const upload = (items) => ingest.batch('writer', workspace, sources[0], { events: items });
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const valid = ajv.getSchema(`${schema.$id}#/$defs/Event`);
  await t.test(
    'one redaction overflow rejects only that record and cannot poison a later run',
    async () => {
      const batch = await upload([
        input('overflow', '2026-10-25T00:00:00Z', { message: 'x'.repeat(4088) + ' token=a' }),
        input('valid', '2026-10-25T00:00:01Z'),
      ]);
      assert.deepEqual([batch.accepted, batch.rejected], [1, 1]);
      assert.equal(batch.results[0].code, 'INVALID_EVENT');
      const id = batch.results[1].event_id;
      assert.equal(valid(await events.detail('operator', workspace, sources, id)), true);
      const run = await f.runs.create('operator', workspace, {
        root_event_id: id,
        source_ids: sources,
        window: { from: '2026-10-25T00:00:00Z', to: '2026-10-25T00:01:00Z' },
        mode: 'rule_only',
      });
      assert.equal(run.status, 'completed');
    },
  );
  await t.test(
    'different microseconds conflict, equivalent spelling duplicates, unsupported precision rejects per item',
    async () => {
      const first = await upload([input('micro', '2026-10-25T01:00:00.123456Z')]);
      const again = await upload([
        input('micro', '2026-10-25T01:00:00.123456000Z'),
        input('micro', '2026-10-25T01:00:00.123999Z'),
        input('too-precise', '2026-10-25T01:00:00.1234567Z'),
      ]);
      assert.deepEqual(
        again.results.map((x) => x.code ?? x.status),
        ['duplicate', 'SOURCE_EVENT_CONFLICT', 'UNSUPPORTED_TIMESTAMP_PRECISION'],
      );
      const row = await events.detail('operator', workspace, sources, first.results[0].event_id);
      assert.equal(row.occurred_at, '2026-10-25T01:00:00.123456Z');
      assert.equal(valid(row), true);
    },
  );
  await t.test(
    'submicrosecond filter bounds never include an event outside the requested interval',
    async () => {
      await upload([
        input('lower', '2026-10-25T02:00:00Z'),
        input('upper', '2026-10-25T02:00:01Z'),
      ]);
      const page = async (from, to) =>
        events.page(
          'operator',
          workspace,
          sources,
          eventQuery({ from, to }),
          await events.snapshot(),
          null,
        );
      assert.deepEqual(await page('2026-10-25T02:00:00.0000001Z', '2026-10-25T02:00:00.5Z'), []);
      assert.deepEqual(await page('2026-10-25T02:00:00.5Z', '2026-10-25T02:00:00.9999999Z'), []);
      assert.equal((await page('2026-10-25T02:00:00Z', '2026-10-25T02:00:00Z')).length, 1);
    },
  );
});
