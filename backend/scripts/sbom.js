// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run sbom or npm run sbom:check');
const check = process.argv.includes('--check');
const frontend = process.argv.includes('--frontend');
const directory = frontend ? 'frontend' : '.';
const args = [
  'sbom',
  '--package-lock-only',
  '--sbom-format=cyclonedx',
  '--sbom-type=application',
  '--offline',
  '--ignore-scripts',
];
// The frontend lock omits dependencies of the optional WASM toolchain. Do not
// force npm past that error or imply this is a complete cross-platform SBOM.
if (frontend) args.push('--omit=optional');
const bom = JSON.parse(
  execFileSync(process.execPath, [npm, ...args], {
    cwd: join(root, directory),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const manifest = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8'));
// npm's root display name can depend on the checkout directory. Keep the
// manifest identity, and omit run-specific fields so drift checks are stable.
bom.metadata.component.name = manifest.name;
delete bom.serialNumber;
delete bom.metadata.timestamp;
bom.metadata.properties = [
  {
    name: 'traceweaver:scope',
    value: frontend
      ? 'Frontend lockfile tree with optional dependencies omitted; see sbom/README.md'
      : 'Root/backend lockfile tree including development dependencies',
  },
];
assert.equal(bom.bomFormat, 'CycloneDX');
assert.equal(bom.specVersion, '1.5');
const components = [bom.metadata.component, ...bom.components];
const refs = new Set(components.map((component) => component['bom-ref']));
assert.equal(refs.size, components.length, 'Duplicate component reference');
for (const component of components) {
  assert.ok(component.name && component.version && component.purl, 'Missing component identity');
  assert.ok(component.licenses?.length, `Missing license: ${component.name}`);
}
for (const dependency of bom.dependencies) {
  assert.ok(refs.has(dependency.ref), 'Unknown dependency reference');
  for (const ref of dependency.dependsOn ?? [])
    assert.ok(refs.has(ref), 'Unknown dependency target');
}
const path = join(root, 'sbom', frontend ? 'frontend.cdx.json' : 'backend.cdx.json');
const content = JSON.stringify(bom, null, 2) + '\n';
if (check)
  assert.equal(
    (await readFile(path, 'utf8')).replace(/\r\n/g, '\n'),
    content,
    'SBOM drift; regenerate with npm run sbom',
  );
else {
  await mkdir(join(root, 'sbom'), { recursive: true });
  await writeFile(path, content);
}
console.log(
  `${frontend ? 'Frontend (optional omitted)' : 'Backend'} SBOM ${check ? 'verified' : 'generated'}: ${bom.components.length} components.`,
);
