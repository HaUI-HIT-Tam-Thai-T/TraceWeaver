// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = join(root, '.local', 'council-evidence', stamp);
await mkdir(destination, { recursive: true });
const report = { schema_version: 1, started_at: new Date().toISOString(), source: {},
  scope: 'Backend proof only; JWKS identity fixture is local HTTP, not a live IdP or full FE/AI demo.',
  environment: { node: process.version, platform: platform(), os_release: release(),
    cpu_count: cpus().length, memory_gib: Math.round(totalmem() / 2 ** 30) }, checks: [] };
const run = (id, args, kind = 'check') => {
  const start = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true,
    timeout: 180000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, npm_config_cache: join(root, '.local', 'npm-cache') } });
  const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  const check = { id, command: ['node', ...args], exit_code: result.status, duration_ms: Date.now() - start,
    status: result.status === 0 && !result.error ? 'pass' : 'fail' };
  // Persist structured summaries only: child output can contain paths or fixtures.
  if (kind === 'test') {
    check.counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'].map((key) =>
      [key, Number(output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'))?.[1] ?? -1)]));
    if (check.counts.tests < 1 || check.counts.pass !== check.counts.tests ||
        ['fail', 'skipped', 'cancelled', 'todo'].some((key) => check.counts[key] !== 0)) check.status = 'fail';
    if (check.status === 'fail') {
      check.error_codes = [...new Set([...output.matchAll(/^\s+code: '?([A-Z][A-Z0-9_]{1,63})'?\s*$/gm)].map((x) => x[1]))];
      check.failure_types = [...new Set([...output.matchAll(/^\s+failureType: '([a-zA-Z]+)'\s*$/gm)].map((x) => x[1]))];
    }
  }
  if (kind === 'audit') {
    try { check.vulnerabilities = JSON.parse(result.stdout).metadata.vulnerabilities;
      if (check.vulnerabilities.total !== 0) check.status = 'fail'; }
    catch { check.status = 'fail'; }
  }
  if (result.error) check.failure = 'Child failed or exceeded its bounded execution time; rerun the named command for diagnostics.';
  report.checks.push(check); console.log(`${id}: ${check.status}`);
};

try {
  report.source = { commit: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
    tracked_clean: git('status', '--porcelain', '--untracked-files=normal') === '' };
  if (!report.source.tracked_clean) throw new Error('Commit tracked changes before collecting submission evidence');
  const paths = git('ls-files', 'backend/src', 'backend/scripts', 'backend/tests', 'backend/contracts', 'package.json', 'package-lock.json').split('\n').sort();
  const digest = createHash('sha256');
  for (const path of paths) { digest.update(path + '\0'); digest.update(await readFile(join(root, path))); }
  report.source.backend_sha256 = digest.digest('hex');
  report.source.tracked_files = paths.length;
  const history = git('log', '--reverse', '--format=%H%x09%aI%x09%cI%x09%s');
  await writeFile(join(destination, 'git-history.tsv'), 'commit\tauthor_time\tcommitter_time\tsubject\n' + history + '\n');
  report.source.git_commits = history.split('\n').length;
  report.history_limit = 'Local reachable history only; reconcile repository creation and contest start/deadline with the official announcement. Never backdate or rewrite history for scoring.';
  run('base_license_headers', ['backend/scripts/check-base.js']);
  run('dependency_notices', ['backend/scripts/dependency-inventory.js', '--check']);
  run('unit_http_contract', ['--test', '--test-reporter=tap', 'backend/tests/backend/*.test.js', 'backend/tests/contracts/*.test.js'], 'test');
  // Bound simultaneous fixture pools on small development machines. Assertions
  // for concurrent transactions inside each file still execute unchanged.
  run('postgresql', ['--env-file-if-exists=.env', '--test', '--test-concurrency=1', '--test-reporter=tap', 'backend/tests/integration/*.test.js'], 'test');
  run('identity_native_http', ['--env-file-if-exists=.env', '--import', './backend/tests/support/oidc-native-loader.js',
    '--test', '--test-concurrency=1', '--test-reporter=tap', 'backend/tests/identity/*.test.js'], 'test');
  run('source_process_readiness', ['backend/scripts/smoke.js']);
  const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  run('npm_advisories', [npmCli, 'audit', '--json', '--ignore-scripts'], 'audit');
} catch (error) {
  report.checks.push({ id: 'collector_preconditions', status: 'fail', failure: error.message === 'Commit tracked changes before collecting submission evidence'
    ? error.message : 'Cannot collect source/environment evidence; inspect local prerequisites. No credentials recorded.' });
}
report.finished_at = new Date().toISOString();
report.result = report.checks.length === 7 && report.checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
report.limits = ['No frontend/AI/model evaluation or full product acceptance.', 'No Docker rebuild/fresh OS/offline install/backup restore proven by this collector.',
  'Database tests create and retain isolated databases.', 'No remote CI/public release or judge score is asserted.'];
await writeFile(join(destination, 'backend-evidence.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(join(destination, 'README.md'), `# Backend evidence\n\nSource: ${report.source.commit ?? 'unavailable'}\n\nResult: ${report.result}\n\n` +
  report.checks.map((x) => `- ${x.id}: ${x.status}${x.counts ? ` (${x.counts.pass}/${x.counts.tests}, skipped=${x.counts.skipped})` : ''}`).join('\n') +
  '\n\n' + report.limits.map((x) => '- ' + x).join('\n') + '\n');
console.log(`Backend evidence: ${report.result}; ${destination}`);
if (report.result !== 'pass') process.exitCode = 1;
