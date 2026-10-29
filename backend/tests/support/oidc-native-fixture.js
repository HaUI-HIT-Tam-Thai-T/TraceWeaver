// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
// Native HTTP alternative to oidc-simulation.js for local/CI identity tests.
// Mirrors backend/postman/mocks/oidc/default.js over real loopback HTTP.
// The application verifier is real. Postman CLI lifecycle is tested separately.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

export async function identitySimulation(t, failure = '') {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', use: 'sig', alg: 'RS256' };
  const records = [], timers = new Set();
  const server = createServer((req, res) => {
    records.push(JSON.stringify({ event: 'request', method: req.method, path: req.url }));
    if (req.method !== 'GET' || req.url !== '/oidc/realms/traceweaver/protocol/openid-connect/certs') {
      res.writeHead(501); res.end('Endpoint outside this dependency contract'); return;
    }
    const ready = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ keys: [jwk] })); };
    if (failure === 'hang') {
      const timer = setTimeout(() => { timers.delete(timer); ready(); }, 1000);
      timers.add(timer); return;
    }
    if (failure === 'html') { res.writeHead(500, { 'content-type': 'text/html' }); res.end('<h1>Unavailable</h1>'); return; }
    if (failure === 'json') { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"unavailable"}'); return; }
    ready();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const issuer = `http://127.0.0.1:${server.address().port}/oidc/realms/traceweaver`;
  return {
    config: { oidcIssuer: issuer, oidcJwksUri: `${issuer}/protocol/openid-connect/certs`,
      oidcAudience: 'traceweaver-api', oidcUserClientId: 'traceweaver-web', oidcTimeoutMs: 300 },
    token: (overrides = {}, key = privateKey) => new SignJWT({
      iss: issuer, aud: 'traceweaver-api', sub: 'alice', typ: 'Bearer', azp: 'traceweaver-web',
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
    }).setProtectedHeader({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }).sign(key),
    logs: () => records.join('\n'),
    async waitForRequest() {
      if (!records.length) throw new Error('Native fixture received no JWKS HTTP request');
    },
  };
}
