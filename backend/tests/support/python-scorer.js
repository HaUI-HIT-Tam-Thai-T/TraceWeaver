// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SANDBOX_MODEL_VERSION } from '../../src/core/reconstruction/scorer-model.js';

export async function pythonScorer(t, { model = false } = {}) {
  const secret = randomBytes(32).toString('hex');
  const script =
    "import socket,uvicorn\nfrom ai.app.api import create_app\nfrom ai.app.config import read_config\ns=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1],flush=True)\nuvicorn.Server(uvicorn.Config(create_app(read_config()),log_level='error')).run(sockets=[s])";
  const child = spawn(process.env.SCORER_PYTHON, ['-c', script], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: {
      ...process.env,
      APP_ENV: 'test',
      SCORER_MODE: model ? 'model' : 'baseline',
      SCORER_MODEL_PATH: model
        ? fileURLToPath(
            new URL('../../../ai/artifacts/sandbox-v2/model_sandbox_v2.json', import.meta.url),
          )
        : '',
      SCORER_SERVICE_SECRET: secret,
      PYTHONDONTWRITEBYTECODE: '1',
    },
  });
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  }
  t.after(stop);
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Python scorer startup timed out')), 10000);
    const finish = (work) => {
      clearTimeout(timer);
      work();
    };
    child.stdout.once('data', (chunk) => finish(() => resolve(Number(chunk.toString().trim()))));
    child.once('error', () => finish(() => reject(new Error('Python scorer could not start'))));
    child.once('exit', () => finish(() => reject(new Error('Python scorer exited before ready'))));
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(500) })).ok) {
        return {
          scorerUrl: `${base}/internal/v1/score-pairs`,
          scorerSecret: secret,
          scorerModelVersion: model ? SANDBOX_MODEL_VERSION : '',
          stop,
        };
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Python scorer did not become ready');
}
