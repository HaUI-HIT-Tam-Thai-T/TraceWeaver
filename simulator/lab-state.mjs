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
export function changeCapacity(state, ram, expectedVersion) {
  capacity(ram);
  if (state.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
  const allocated = state.requests.filter(r => r.environment).reduce((n, r) => n + r.ram, 0);
  if (ram < allocated) throw new Error('RAM_ALREADY_ALLOCATED');
  return { ...structuredClone(state), ram, version: state.version + 1 };
}
export function submitRequest(state, { id = randomUUID(), ram = 4 } = {}) {
  capacity(ram);
  if (!ram || typeof id !== 'string' || !id.trim() || id.length > 200) throw new Error('INVALID_REQUEST');
  if (state.requests.some(r => r.id === id)) throw new Error('REQUEST_EXISTS');
  if (state.requests.length >= 1000) throw new Error('REQUEST_LIMIT');
  const next = structuredClone(state);
  next.requests.push({ id, ram, attempts: [], environment: null });
  next.version++;
  return next;
}
export function provision(state, requestId, { expectedVersion, operationId, now = new Date().toISOString() }) {
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 200) throw new Error('INVALID_OPERATION');
  const request = state.requests.find(r => r.id === requestId);
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const replay = state.requests.flatMap(r => r.attempts).find(a => a.operation_id === operationId);
  if (replay) {
    if (!request.attempts.includes(replay)) throw new Error('IDEMPOTENCY_CONFLICT');
    return structuredClone(state);
  }
  if (expectedVersion !== state.version) throw new Error('VERSION_CONFLICT');
  if (request.environment) throw new Error('ALREADY_PROVISIONED');
  if (request.attempts.length >= 20) throw new Error('ATTEMPT_LIMIT');
  if (!Number.isFinite(Date.parse(now))) throw new Error('INVALID_TIME');
  const next = structuredClone(state), target = next.requests.find(r => r.id === requestId);
  const used = next.requests.filter(r => r.environment).reduce((n, r) => n + r.ram, 0);
  const success = next.ram - used >= target.ram;
  const attempt = { id: randomUUID(), operation_id: operationId, number: target.attempts.length + 1,
    at: now, result: success ? 'passed' : 'failed', reason: success ? null : 'INSUFFICIENT_RAM',
    required_ram: target.ram, available_ram: next.ram - used };
  target.attempts.push(attempt);
  if (success) target.environment = { id: randomUUID(), attempt_id: attempt.id, ram: target.ram, state: 'running' };
  next.events.push({ id: randomUUID(), request_id: requestId, attempt_id: attempt.id,
    occurred_at: now, action: success ? 'environment_created' : 'environment_failed', reason: attempt.reason });
  next.version++;
  return next;
}
export function inspectRequest(state, requestId) {
  const request = state.requests.find(r => r.id === requestId);
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const latest = request.attempts.at(-1);
  return structuredClone({ source: 'lab-sandbox', checker_version: 'lab-state-1',
    source_version: state.version, request_id: requestId,
    result: !latest ? 'inconclusive' : request.environment?.attempt_id === latest.id &&
      request.environment.state === 'running' ? 'passed' : 'failed',
    attempt: latest ?? null, environment: request.environment });
}
