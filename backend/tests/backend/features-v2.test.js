// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from '../fixtures/scorer-v2/features-v2.json' with { type: 'json' };
import { pairFeatures } from '../../src/core/reconstruction/scorer.js';
import { casefold } from '../../src/core/reconstruction/casefold.js';

test('full casefold preserves Turkic distinctions and handles Greek/Cherokee folds', () => {
  assert.equal(casefold('Straße ẞ Σςσ'), 'strasse ss σσσ');
  assert.equal(casefold('Iİıi'), 'ii\u0307ıi');
  assert.equal(casefold('\u13a0\uab70'), '\u13a0\u13a0');
});

// Unmodified independent golden cases from AI_BE_RUNTIME_V2 (Apache-2.0).
for (const fixture of fixtures.cases) {
  test(`feature v2 conformance: ${fixture.id}`, () => {
    const actual = pairFeatures(fixture.from_event, fixture.to_event);
    const expected = fixture.expected_features;
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(typeof actual[key], typeof value, key);
      if (typeof value === 'boolean') assert.equal(actual[key], value, key);
      else {
        assert.ok(Number.isFinite(actual[key]), key);
        assert.ok(Math.abs(actual[key] - value) <= (fixtures.numeric_tolerance[key] ?? 0), key);
      }
    }
  });
}
