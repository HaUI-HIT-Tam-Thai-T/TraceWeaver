// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('../../contracts/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const schema = await json('schemas/domain.schema.json');
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema);
const validator = (name) => ajv.getSchema(`${schema.$id}#/$defs/${name}`);

test('OpenAPI validates with all local refs and no remote resolution', async () => {
  const api = await SwaggerParser.validate(fileURLToPath(new URL('openapi.json', root)), { resolve: { http: false } });
  assert.equal(api.openapi, '3.1.0');
  const operations = Object.entries(api.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, op]) => ({ path, method, ...op })));
  assert.equal(operations.length, 28);
  assert.equal(new Set(operations.map((op) => op.operationId)).size, operations.length);
  const implemented = new Set(['getMe', 'listSources', 'listKnowledge', 'ingestEvents', 'listEvents', 'getEvent', 'createRun', 'getRun', 'getGraph', 'reviewLink', 'createManualLink', 'createCase', 'listCases', 'getCase', 'addEvidence', 'transitionCase', 'getDashboard', 'createWorkflowInstance', 'transitionWorkflowInstance', 'getWorkflowInstance', 'scorePairs']);
  implemented.add('listCaseAssignees');
  for (const name of ['getLabSandbox', 'configureLabSandbox', 'commandLabSandbox', 'inspectLabRequest', 'listCaseVerifications', 'verifyCaseSource']) implemented.add(name);
  for (const op of operations) {
    assert.equal(op['x-implementation-status'], implemented.has(op.operationId) ? 'implemented' : 'planned');
    assert.equal(op.security.length, 1);
    if (op.path.startsWith('/core/')) {
      assert.deepEqual(Object.keys(op.security[0]).sort(), ['appServiceBearer', 'delegatedUserBearer']);
      assert.ok(op.parameters.some((p) => p.name === 'X-Workspace-Id' && p.in === 'header' && p.required));
    }
    for (const param of op.path.matchAll(/\{(\w+)\}/g)) {
      assert.ok(op.parameters.some((p) => p.in === 'path' && p.name === param[1] && p.required));
    }
  }
  for (const prefix of ['/api/v1/', '/core/v1/', '/internal/v1/']) {
    assert.ok(operations.some((op) => op.path.startsWith(prefix)), prefix);
  }
});

test('all reusable schemas compile strictly and positive fixtures conform', async () => {
  const valid = await json('fixtures/valid.json');
  assert.deepEqual(Object.keys(valid).sort(), Object.keys(schema.$defs).sort());
  for (const [name, data] of Object.entries(valid)) {
    const validate = validator(name);
    assert.equal(validate(data), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
});

test('negative fixtures fail for the specified reason', async () => {
  for (const fixture of await json('fixtures/invalid.json')) {
    const validate = validator(fixture.schema);
    assert.equal(validate(fixture.data), false, fixture.name);
    assert.ok(validate.errors.some((error) => error.keyword === fixture.keyword), `${fixture.name}: ${JSON.stringify(validate.errors)}`);
  }
});

test('partial ingest validates envelope separately from individual records', async () => {
  const valid = await json('fixtures/valid.json');
  assert.equal(validator('BatchRequest')({ events: [valid.EventInput, { bad: 'record' }, null] }), true);
  assert.equal(validator('EventInput')({ bad: 'record' }), false);
});

test('NaN and Infinity cannot be scorer output values in JS validation', async () => {
  for (const score of [NaN, Infinity, -Infinity]) {
    assert.equal(validator('ScoreResponse')({ model_version: 'test', feature_schema_version: '1', predictions: [{ pair_id: 'p1', score }] }), false);
  }
});
