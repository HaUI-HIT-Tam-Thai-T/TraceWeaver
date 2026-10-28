// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function checkFeatures(actual, expected, tolerance) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new Error('Expected feature object');
  if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(Object.keys(expected).sort())) {
    throw new Error('Incorrect feature keys');
  }
  for (const [key, value] of Object.entries(expected)) {
    const result = actual[key];
    if (typeof value === 'boolean') {
      if (typeof result !== 'boolean' || result !== value) throw new Error(`Incorrect ${key}`);
    } else {
      if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error(`Invalid number: ${key}`);
      if (key === 'shared_id_count' && !Number.isInteger(result)) throw new Error('Count must be an integer');
      if (Math.abs(result - value) > (tolerance[key] ?? 0)) throw new Error(`Incorrect ${key}`);
    }
  }
}

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node check_features.cjs ./node_extractor.cjs [fixtures.json]');
  const adapter = await import(pathToFileURL(path.resolve(process.argv[2])).href);
  const extract = adapter.extractPairFeatures ?? adapter.default?.extractPairFeatures ?? adapter.default;
  if (typeof extract !== 'function') throw new Error('Adapter must export extractPairFeatures(left, right)');
  const fixtures = JSON.parse(fs.readFileSync(process.argv[3] || path.join(__dirname, 'features-v2.json'), 'utf8'));
  let passed = 0;
  for (const fixture of fixtures.cases) {
    try {
      checkFeatures(await extract(fixture.from_event, fixture.to_event), fixture.expected_features,
                    fixtures.numeric_tolerance);
      passed++;
    } catch (error) {
      console.error(`FAIL ${fixture.id}: ${error.message}`);
    }
  }
  console.log(`Node adapter: ${passed}/${fixtures.cases.length} fixtures passed`);
  if (passed !== fixtures.cases.length) process.exitCode = 1;
}

module.exports = { checkFeatures };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
