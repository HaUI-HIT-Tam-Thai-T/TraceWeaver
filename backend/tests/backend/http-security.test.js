// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { gzipSync } from 'node:zlib';

test('compressed bodies are rejected on public/core APIs and trailing bytes cannot crash the process', async () => {
  const source = `import {createApp} from './backend/src/app.js';const s=createApp({checkReadiness:async()=>true}).listen(0,'127.0.0.1',()=>console.log(s.address().port));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('../../../', import.meta.url),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  child.stderr.resume();
  const deadline = setTimeout(() => child.kill(), 10000);
  try {
    const [line] = await once(child.stdout, 'data');
    const base = `http://127.0.0.1:${Number(line.toString().trim())}`;
    for (const prefix of ['/api/v1', '/core/v1']) {
      const response = await fetch(`${base}${prefix}/not-a-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
        body: gzipSync('{}'),
      });
      assert.equal(response.status, 415);
      assert.equal((await response.json()).error.code, 'UNSUPPORTED_ENCODING');
    }
    const response = new Promise((resolve, reject) => {
      const req = request(
        `${base}/api/v1/not-a-route`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Transfer-Encoding': 'chunked',
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.write(Buffer.concat([gzipSync('{}'), Buffer.alloc(1)]));
      setTimeout(() => req.end('trailing-junk'), 100);
    });
    assert.equal(await response, 415);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal((await fetch(`${base}/health/live`)).status, 200);
    assert.equal(child.exitCode, null);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill();
    await closed;
  }
});
