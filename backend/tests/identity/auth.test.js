// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import { createServer } from 'node:net';
import { once } from 'node:events';
import {
  createTokenVerifier,
  createIngestTokenVerifier,
} from '../../src/core/identity/token-verifier.js';
import { createCursorCodec } from '../../src/core/identity/cursor.js';
import { identitySimulation } from '../support/oidc-simulation.js';

test('JWT verification uses the Postman JWKS HTTP dependency and ignores token role claims', async (t) => {
  const sim = await identitySimulation(t);
  const verify = createTokenVerifier(sim.config);
  assert.deepEqual(await verify(await sim.token({ roles: ['admin'] })), { subject: 'alice' });
  const ingest = createIngestTokenVerifier({
    ...sim.config,
    oidcIngestClientId: 'traceweaver-ingest',
  });
  assert.deepEqual(await ingest(await sim.token({ azp: 'traceweaver-ingest' })), {
    subject: 'alice',
  });
  await assert.rejects(ingest(await sim.token()), { status: 401 });
  await assert.rejects(ingest(await sim.token({ azp: 'traceweaver-ingest', typ: 'ID' })), {
    status: 401,
  });
  const other = await generateKeyPair('RS256');
  for (const token of [
    await sim.token({ exp: 1 }),
    await sim.token({ aud: 'wrong-api' }),
    await sim.token({ iss: 'https://wrong.example.test' }),
    await sim.token({ azp: 'traceweaver-ingest' }),
    await sim.token({ typ: 'ID' }),
    await sim.token({ sub: '' }),
    await sim.token({ exp: undefined }),
    await sim.token({ nbf: Math.floor(Date.now() / 1000) + 1000 }),
    await sim.token({}, other.privateKey),
    'not-a-jwt',
  ])
    await assert.rejects(verify(token), { status: 401 });
  await sim.waitForRequest();
  assert.match(sim.logs(), /certs/);
});

test('unreachable JWKS fails closed within the configured timeout', async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const issuer = `http://127.0.0.1:${port}/realms/test`;
  const { privateKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({ sub: 'alice', typ: 'Bearer', azp: 'web' })
    .setIssuer(issuer)
    .setAudience('api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(privateKey);
  const verify = createTokenVerifier({
    oidcIssuer: issuer,
    oidcJwksUri: `${issuer}/certs`,
    oidcAudience: 'api',
    oidcUserClientId: 'web',
    oidcTimeoutMs: 300,
  });
  const started = Date.now();
  await assert.rejects(verify(token), { status: 503 });
  assert.ok(Date.now() - started < 3000);
});

test('Identity HTTP JSON/HTML errors and timeout fail closed as 503', async (t) => {
  for (const failure of ['json', 'html', 'hang']) {
    await t.test(failure, async (sub) => {
      const sim = await identitySimulation(sub, failure);
      const started = Date.now();
      await assert.rejects(createTokenVerifier(sim.config)(await sim.token()), { status: 503 });
      assert.ok(Date.now() - started < 3000);
      await sim.waitForRequest();
    });
  }
});

test('cursor binds workspace, user, filter and current scope and rejects tampering', () => {
  const codec = createCursorCodec('test-cursor-secret-at-least-32-characters');
  const context = { workspace: 'w1', subject: 'alice', q: '', scope: 'old' };
  const id = '11111111-1111-4111-8111-111111111111';
  const cursor = codec.encode(context, id);
  assert.equal(codec.decode(cursor, context), id);
  for (const field of Object.keys(context))
    assert.throws(() => codec.decode(cursor, { ...context, [field]: 'changed' }), { status: 400 });
  assert.throws(() => codec.decode(`tampered.${cursor.split('.')[1]}`, context), { status: 400 });
  assert.throws(() => codec.decode(`${cursor}!`, context), { status: 400 });
});
