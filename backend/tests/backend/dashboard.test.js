// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardQuery } from '../../src/validations/dashboard.validation.js';
import { createDashboardService } from '../../src/services/dashboard.service.js';

test('dashboard accepts only bounded scalar UTC filters with exact fractional ordering', () => {
  assert.deepEqual(dashboardQuery({}), {});
  const filters = { from: '2026-10-24T00:00:00.0000001Z', to: '2026-10-24T00:00:00.0000002Z' };
  assert.deepEqual(dashboardQuery(filters), filters);
  for (const query of [{ source_id: 'hidden' }, { from: '' }, { to: ['a', 'b'] }, { from: '0000-01-01T00:00:00Z' },
    { from: '2026-02-30T00:00:00Z' }, { from: '2026-10-24T00:00:00+07:00' },
    { from: filters.to, to: filters.from }, { from: '2026-10-24T00:00:00.' + '1'.repeat(150) + 'Z' }]) {
    assert.throws(() => dashboardQuery(query), { status: 400 });
  }
});

test('dashboard service validates before reading and sanitizes operational failures', async () => {
  let reads = 0;
  const service = createDashboardService({ get: async () => { reads++; throw new Error('private database password'); } });
  await assert.rejects(service.get('actor', 'workspace', { unknown: 'x' }), { status: 400 });
  assert.equal(reads, 0);
  await assert.rejects(service.get('actor', 'workspace', {}), (error) => error.status === 503 && !error.message.includes('private'));
});
