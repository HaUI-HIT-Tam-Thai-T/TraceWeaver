// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto';

// Pure source-domain transitions. Persistence and HTTP adapters own transactions.
export function createLab({ ram = 2 } = {}) {
  capacity(ram);
  return { version: 1, ram, requests: [], events: [] };
}
function capacity(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1048576) throw new Error('INVALID_RAM');
}
function copyForChange(state) {
  const next = structuredClone(state);
  // Global version serializes commands; request version tracks relevant source changes.
  // Legacy snapshots retain their old global freshness policy until a new execution.
  for (const request of next.requests) request.verification_version ??= state.version;
  return next;
}
export function changeCapacity(state, ram, expectedVersion) {
  capacity(ram);
  if (state.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
  const allocated = state.requests.filter((r) => r.environment).reduce((n, r) => n + r.ram, 0);
  if (ram < allocated) throw new Error('RAM_ALREADY_ALLOCATED');
  const next = copyForChange(state);
  if (ram !== state.ram)
    for (const request of next.requests) request.verification_version = state.version + 1;
  return { ...next, ram, version: state.version + 1 };
}
export function submitRequest(
  state,
  { id = randomUUID(), ram = 4, image_available = true, account_active = true } = {},
) {
  capacity(ram);
  if (!ram || typeof id !== 'string' || !id.trim() || id.length > 200)
    throw new Error('INVALID_REQUEST');
  if (state.requests.some((r) => r.id === id)) throw new Error('REQUEST_EXISTS');
  if (state.requests.length >= 1000) throw new Error('REQUEST_LIMIT');
  const next = copyForChange(state);
  if (typeof image_available !== 'boolean' || typeof account_active !== 'boolean')
    throw new Error('INVALID_CONDITION');
  next.requests.push({
    id,
    ram,
    image_id: `lab-image-${id}`,
    account_id: `lab-account-${id}`,
    image_available,
    account_active,
    verification_version: state.version + 1,
    attempts: [],
    environment: null,
  });
  next.version++;
  return next;
}
export function changeCondition(state, command) {
  if (state.version !== command.expected_version) throw new Error('VERSION_CONFLICT');
  const next = copyForChange(state),
    r = next.requests.find((r) => r.id === command.request_id);
  if (!r) throw new Error('REQUEST_NOT_FOUND');
  const image = command.action === 'image';
  if (!image && command.action !== 'account') throw new Error('INVALID_ACTION');
  const key = image ? 'image_id' : 'account_id';
  const value = image ? command.available : command.active;
  if (typeof value !== 'boolean') throw new Error('INVALID_CONDITION');
  if (command[key] !== (r[key] ?? `lab-${image ? 'image' : 'account'}-${r.id}`))
    throw new Error('RESOURCE_MISMATCH');
  const condition = image ? 'image_available' : 'account_active';
  if (r[condition] !== value) r.verification_version = state.version + 1;
  r[condition] = value;
  next.version++;
  return next;
}
export function provision(
  state,
  requestId,
  { expectedVersion, operationId, now = new Date().toISOString() },
) {
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 200)
    throw new Error('INVALID_OPERATION');
  const request = state.requests.find((r) => r.id === requestId);
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const replay = state.requests
    .flatMap((r) => r.attempts)
    .find((a) => a.operation_id === operationId);
  if (replay) {
    if (!request.attempts.includes(replay)) throw new Error('IDEMPOTENCY_CONFLICT');
    return structuredClone(state);
  }
  if (expectedVersion !== state.version) throw new Error('VERSION_CONFLICT');
  if (request.attempts.length >= 20) throw new Error('ATTEMPT_LIMIT');
  if (!Number.isFinite(Date.parse(now))) throw new Error('INVALID_TIME');
  const next = copyForChange(state),
    target = next.requests.find((r) => r.id === requestId);
  const used = next.requests
    .filter((r) => r.id !== requestId && r.environment)
    .reduce((n, r) => n + r.ram, 0);
  target.image_id ??= `lab-image-${requestId}`;
  target.account_id ??= `lab-account-${requestId}`;
  target.image_available ??= true;
  target.account_active ??= true;
  const checks = [
    { step: 'ram', passed: next.ram - used >= target.ram, reason: 'INSUFFICIENT_RAM' },
    { step: 'image', passed: target.image_available === true, reason: 'IMAGE_UNAVAILABLE' },
    { step: 'account', passed: target.account_active === true, reason: 'ACCOUNT_DISABLED' },
  ];
  const blockers = checks.filter((c) => !c.passed).map((c) => c.reason);
  const success = blockers.length === 0;
  const attempt = {
    id: randomUUID(),
    operation_id: operationId,
    number: target.attempts.length + 1,
    at: now,
    source_version: next.version + 1,
    checker_version: 'lab-state-2',
    result: success ? 'passed' : 'failed',
    reason: blockers[0] ?? null,
    blockers,
    checks,
    image_id: target.image_id,
    account_id: target.account_id,
    image_available: target.image_available,
    account_active: target.account_active,
    required_ram: target.ram,
    available_ram: next.ram - used,
  };
  target.attempts.push(attempt);
  target.verification_version = attempt.source_version;
  if (success)
    target.environment = {
      id: target.environment?.id ?? randomUUID(),
      attempt_id: attempt.id,
      ram: target.ram,
      image_id: target.image_id,
      account_id: target.account_id,
      state: 'running',
    };
  else if (target.environment)
    target.environment = { ...target.environment, state: 'stopped', attempt_id: attempt.id };
  next.events.push({
    id: randomUUID(),
    request_id: requestId,
    attempt_id: attempt.id,
    occurred_at: now,
    action: success ? 'environment_created' : 'environment_failed',
    reason: attempt.reason,
  });
  next.version++;
  return next;
}
export function inspectRequest(state, requestId) {
  const request = state.requests.find((r) => r.id === requestId);
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const latest = request.attempts.at(-1);
  const env = request.environment;
  const allocated = state.requests
    .filter((r) => r.environment)
    .reduce((n, r) => n + r.environment.ram, 0);
  const used = state.requests
    .filter((r) => r.id !== requestId && r.environment)
    .reduce((n, r) => n + r.environment.ram, 0);
  const stale =
    latest &&
    (latest.source_version !== (request.verification_version ?? state.version) ||
      (latest.result === 'failed' && latest.available_ram !== state.ram - used));
  const valid =
    latest?.checker_version === 'lab-state-2' &&
    !stale &&
    latest.result === 'passed' &&
    latest.reason === null &&
    latest.blockers?.length === 0 &&
    latest.checks?.length === 3 &&
    ['ram', 'image', 'account'].every(
      (step) => latest.checks.filter((c) => c.step === step && c.passed === true).length === 1,
    ) &&
    latest.required_ram === request.ram &&
    latest.available_ram >= request.ram &&
    latest.image_id === request.image_id &&
    latest.account_id === request.account_id &&
    latest.image_available === true &&
    latest.account_active === true &&
    request.image_available === true &&
    request.account_active === true &&
    env?.attempt_id === latest.id &&
    env.state === 'running' &&
    env.ram === request.ram &&
    env.image_id === request.image_id &&
    env.account_id === request.account_id &&
    allocated <= state.ram;
  return structuredClone({
    source: 'lab-sandbox',
    simulated: true,
    checker_version: 'lab-state-2',
    source_version: state.version,
    request_id: requestId,
    result: !latest ? 'inconclusive' : valid ? 'passed' : stale ? 'inconclusive' : 'failed',
    reason: !latest
      ? 'NOT_EXECUTED'
      : stale
        ? 'RERUN_REQUIRED'
        : valid
          ? null
          : (latest.reason ?? 'INCONSISTENT_SOURCE_STATE'),
    conditions: {
      required_ram: request.ram,
      image_id: request.image_id,
      account_id: request.account_id,
      image_available: request.image_available,
      account_active: request.account_active,
    },
    attempts: request.attempts,
    attempt: latest ?? null,
    environment: request.environment,
  });
}
