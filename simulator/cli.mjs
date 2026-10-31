// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateDataset } from './generate.mjs';
import { apiClient, uploadDataset } from './upload.mjs';

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    if (!/^--[a-z-]+(?:=|$)/.test(arg)) throw new Error('Use --name=value arguments');
    const at = arg.indexOf('=');
    return at < 0 ? [arg.slice(2), true] : [arg.slice(2, at), arg.slice(at + 1)];
  }),
);
const allowed = new Set(['seed', 'base-time', 'count', 'out', 'apply', 'api', 'workspace', 'help']);
for (const key of Object.keys(options))
  if (!allowed.has(key)) throw new Error(`Unknown option: ${key}`);
if (options.apply !== undefined && options.apply !== true)
  throw new Error('Use --apply without a value');
if (options.help) {
  console.log(
    'node simulator/cli.mjs --seed=traceweaver-realistic-v3 --base-time=2026-10-29T01:00:00Z --count=36 --out=.local/simulator/v3',
  );
  console.log(
    'Optional upload: --apply --api=https://api.quizlearn.tech --workspace=UUID; env SIMULATOR_INGEST_TOKEN and SIMULATOR_SOURCE_IDS (JSON service-to-UUID map).',
  );
} else {
  try {
    const d = generateDataset({
      ...(options.seed ? { seed: options.seed } : {}),
      ...(options['base-time'] ? { baseTime: options['base-time'] } : {}),
      ...(options.count ? { count: Number(options.count) } : {}),
    });
    if (options.out) {
      const directory = resolve(options.out);
      await mkdir(directory, { recursive: true });
      for (const [name, value] of Object.entries({
        manifest: d.manifest,
        observable: d.events,
        deliveries: d.deliveries,
        scenarios: d.scenarios,
        oracle: d.oracle,
      })) {
        await writeFile(resolve(directory, `${name}.json`), JSON.stringify(value, null, 2) + '\n', {
          flag: 'wx',
        });
      }
    }
    if (options.apply) {
      const report = await uploadDataset(d, {
        workspaceId: options.workspace,
        sources: JSON.parse(process.env.SIMULATOR_SOURCE_IDS ?? '{}'),
        request: apiClient(options.api, process.env.SIMULATOR_INGEST_TOKEN),
      });
      if (options.out)
        await writeFile(
          resolve(options.out, 'upload-report.json'),
          JSON.stringify(report, null, 2) + '\n',
          { flag: 'wx' },
        );
      console.log(
        JSON.stringify({
          ...d.manifest,
          uploaded: true,
          accepted: report.accepted,
          duplicate: report.duplicate,
          rejected: report.rejected,
        }),
      );
    } else console.log(JSON.stringify({ ...d.manifest, uploaded: false }));
  } catch (error) {
    console.error(
      `SIMULATOR_FAILED: ${error.message?.startsWith('SIMULATOR_HTTP_') ? error.message : (error.code ?? error.name)}`,
    );
    process.exitCode = 1;
  }
}
