// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

export async function identitySimulation(t, failure = '') {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', use: 'sig', alg: 'RS256' };
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.platform === 'win32' ? 'postman.exe' : 'postman', [
    'simulation', 'run', fileURLToPath(new URL('../../postman/simulations/identity.sim.yaml', import.meta.url)),
    '--port', String(port), '--output', 'ndjson',
  ], {
    env: { ...process.env, OIDC_TEST_JWKS: JSON.stringify({ keys: [jwk] }), OIDC_TEST_FAILURE: failure },
    windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', stderr = '', spawnError;
  child.on('error', (error) => { spawnError = error; });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* Already stopped. */ }
      } else {
        try { process.kill(-child.pid, 'SIGINT'); } catch { /* Already stopped. */ }
      }
    }
  });
  for (let attempt = 0; attempt < 200; attempt++) {
    if (spawnError) throw new Error('Postman CLI is required for identity HTTP simulation');
    if (child.exitCode !== null) throw new Error(`Postman simulation exited: ${stderr.slice(-1000)}`);
    if (output.split('\n').some((line) => { try { return JSON.parse(line).type === 'listening' || JSON.parse(line).event === 'listening'; } catch { return false; } })) break;
    if (attempt === 199) throw new Error(`Postman simulation did not become ready: ${output.slice(-500)} ${stderr.slice(-500)}`);
    await delay(100);
  }
  const issuer = `http://127.0.0.1:${port}/oidc/realms/traceweaver`;
  return {
    config: { oidcIssuer: issuer, oidcJwksUri: `${issuer}/protocol/openid-connect/certs`, oidcAudience: 'traceweaver-api', oidcUserClientId: 'traceweaver-web', oidcTimeoutMs: 300 },
    token: (overrides = {}, key = privateKey) => new SignJWT({
      iss: issuer, aud: 'traceweaver-api', sub: 'alice', typ: 'Bearer', azp: 'traceweaver-web',
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
    }).setProtectedHeader({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }).sign(key),
    logs: () => output,
    async waitForRequest() {
      for (let i = 0; i < 40; i++) {
        if (/"event":"request"/.test(output)) return;
        await delay(50);
      }
      throw new Error(`No JWKS request recorded by Postman: ${output.slice(-600)}`);
    },
  };
}
