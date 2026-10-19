// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = async (path) => readFile(join(root, path), 'utf8');
const required = ['LICENSE', 'NOTICE', 'README.md', 'INSTALL.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', '.env.example', '.gitignore', 'Makefile', 'compose.dev.yaml', '.github/workflows/ci.yml', 'backend/DEPENDENCIES.md', 'backend/THIRD_PARTY_NOTICES.txt', 'backend/contracts/openapi.json', 'frontend/README.md', 'ai/README.md', 'simulator/README.md'];
for (const path of required) await access(join(root, path));
assert.match(await read('LICENSE'), /Apache License[\s\S]*Version 2\.0/);
const lock = JSON.parse(await read('package-lock.json'));
for (const [path, key] of [['package.json', ''], ['backend/package.json', 'backend']]) {
  const manifest = JSON.parse(await read(path));
  assert.equal(manifest.license, 'Apache-2.0', path);
  assert.equal(lock.packages[key].license, manifest.license, path);
  for (const field of ['dependencies', 'devDependencies']) {
    assert.deepEqual(lock.packages[key][field] ?? {}, manifest[field] ?? {}, `${path}: ${field}`);
  }
}

async function checkSource(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await checkSource(path);
    else if (/\.(js|sql)$/.test(path)) {
      const license = await read(path.endsWith('.sql') ? `${path}.license` : path);
      assert.match(license, /SPDX-License-Identifier: Apache-2\.0/, path);
      assert.match(license, /SPDX-FileCopyrightText:/, path);
    }
  }
}
for (const directory of ['backend/src', 'backend/scripts', 'backend/tests']) await checkSource(directory);

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
for (const path of tracked) {
  assert.ok(!/(^|\/)\.env($|\.)/.test(path) || path.endsWith('.example'), `Environment secret file tracked: ${path}`);
  assert.ok(!/^(?:\.local|\.planning|node_modules)\//.test(path), `Local files tracked: ${path}`);
  assert.ok(!/\.(?:pem|key|p12|pfx)$/.test(path), `Private key file tracked: ${path}`);
}
console.log('Base checks passed: structure, license, SPDX, manifests and tracked secret-file exclusions.');
