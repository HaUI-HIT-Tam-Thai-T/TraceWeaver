// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { queryParams } from '../../src/validations/access.validation.js';
test('knowledge and pagination query text rejects NUL and invalid Unicode before SQL', () => {
  for (const q of ['\u0000', '\ud800'])
    assert.throws(() => queryParams({ q }, 'knowledge'), { status: 400 });
  assert.throws(() => queryParams({ cursor: '\u0000' }, 'sources'), { status: 400 });
  assert.equal(queryParams({ q: 'cấp môi trường' }, 'knowledge').q, 'cấp môi trường');
});
