// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.SMOKE_PORT ?? 18080);
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'Invalid SMOKE_PORT');
const child = spawn(process.execPath, ['--env-file-if-exists=../.env', 'src/server.js'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, API_HOST: '127.0.0.1', API_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const closed = once(child, 'close');
// Consume sanitized startup messages without printing environment or credentials.
child.stdout.resume();
child.stderr.resume();
try {
  let live = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.equal(child.exitCode, null, 'Backend exited before becoming live');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/live`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok && (await response.json()).status === 'ok') {
        live = true;
        break;
      }
    } catch {
      /* Retry during startup. */
    }
    await delay(100);
  }
  assert.ok(live, 'Backend liveness timed out');
  const ready = await fetch(`http://127.0.0.1:${port}/health/ready`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(ready.status, 200, 'Database/migrations not ready; run db:migrate first');
  assert.deepEqual(await ready.json(), { status: 'ready' });
  console.log('Backend process smoke passed: liveness and database readiness 200.');
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 12000);
  try {
    await closed;
  } finally {
    clearTimeout(deadline);
  }
}
