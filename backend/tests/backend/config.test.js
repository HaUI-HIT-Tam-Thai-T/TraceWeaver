import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config.js';

const valid = { DATABASE_URL: 'postgresql://app:local-password@localhost:5432/traceweaver' };

test('configuration validates defaults and explicit ports', () => {
  assert.equal(readConfig(valid).port, 8080);
  assert.equal(readConfig({ ...valid, API_PORT: '8090' }).port, 8090);
});

test('configuration rejects empty credentials and malformed values without exposing secrets', () => {
  for (const databaseUrl of ['', 'mongodb://app:secret@localhost/db', 'postgresql://app@localhost/db']) {
    assert.throws(() => readConfig({ DATABASE_URL: databaseUrl }), /DATABASE_URL/);
  }
  for (const port of ['abc', '0', '65536', '80.5', '8080oops']) {
    assert.throws(() => readConfig({ ...valid, API_PORT: port }), /API_PORT/);
  }
  assert.throws(() => readConfig({ ...valid, APP_ENV: 'typo' }), /APP_ENV/);
  assert.throws(() => readConfig({ DATABASE_URL: 'private-secret' }), (error) => !error.message.includes('private-secret'));
});
