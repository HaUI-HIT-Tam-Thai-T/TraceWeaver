// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
try {
  if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('SOURCE_NOT_CLEAN');
  const commit = git('rev-parse', 'HEAD'),
    paths = git('ls-tree', '-r', '--name-only', commit).split('\n');
  for (const path of paths) {
    if (
      /^(?:\.local|\.planning|node_modules|evaluation\/private)\//.test(path) ||
      (/(?:^|\/)\.env(?:$|\.)/.test(path) && !path.endsWith('.example')) ||
      /\.(?:pem|key|p12|pfx)$/.test(path) ||
      /(?:^|\/)demo-credentials\.local\.json$/.test(path)
    )
      throw new Error('UNSAFE_ARCHIVE_PATH');
  }
  const output = join(root, '.local', 'council-evidence', 'source-' + commit.slice(0, 12));
  await mkdir(output, { recursive: true });
  const name = `traceweaver-source-${commit.slice(0, 12)}.tar.gz`,
    destination = join(output, name);
  execFileSync(
    'git',
    ['archive', '--format=tar.gz', '--prefix=traceweaver/', '--output', destination, commit],
    { cwd: root, windowsHide: true },
  );
  const bytes = await readFile(destination),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(output, 'SHA256SUMS'), `${sha256}  ${name}\n`);
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify(
      {
        commit,
        archive: name,
        sha256,
        bytes: bytes.length,
        scope:
          'Exact tracked repository source; backend candidate, not a complete FE/AI product release.',
        file_count: paths.length,
        configuration:
          'Supply ignored secrets externally; never copy credentials into the archive.',
        release_status: 'Prepared locally; no tag/release/publication created by this script.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Source archive verified: ${destination}; SHA256 ${sha256}`);
} catch (error) {
  console.error(
    ['SOURCE_NOT_CLEAN', 'UNSAFE_ARCHIVE_PATH'].includes(error.message)
      ? error.message
      : 'SOURCE_PACKAGING_FAILED: inspect clean Git checkout and output permissions; no secrets recorded',
  );
  process.exitCode = 1;
}
