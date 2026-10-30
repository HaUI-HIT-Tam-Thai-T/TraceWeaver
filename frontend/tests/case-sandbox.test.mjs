import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { createSandboxService, sandboxFailure } from '../src/features/case-sandbox/service.ts';
import { sandboxSchema, proofSchema, commandSchema, observationSchema } from '../src/features/case-sandbox/schemas.ts';
import { createCasesController } from '../src/features/cases/state/controller.ts';
import { ApiError } from '../src/services/apiError.ts';
import { proofNotice } from '../src/features/case-sandbox/presentation.ts';
import { CID, CID2, caseDetail } from './case-fixtures.mjs';
import { scope, WID } from './event-fixtures.mjs';
import { graph, run } from './reconstruction-fixtures.mjs';
import { attempt, sandbox, proof, proofs, command, OID } from './sandbox-fixtures.mjs';
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const failure = (code, status = 422) => new ApiError({ kind: status === 401 ? 'auth' : 'http', code, status, message: 'Safe failure' });
async function setup(options = {}) {
  let detail = caseDetail(), observed = sandbox(), history = proofs(), rechecks = 0;
  detail.case.state = options.closed ? 'closed' : 'awaiting_verification'; detail.case.owner_id = 'user-a';
  const posts = [], reads = [], service = {
    getSandbox: async (...args) => { reads.push(['sandbox', ...args]); return options.getSandbox ? options.getSandbox(...args) : structuredClone(observed); },
    getProofs: async (...args) => { reads.push(['proofs', ...args]); return options.getProofs ? options.getProofs(...args) : structuredClone(history); },
    getLab: async (...args) => { reads.push(['lab', ...args]); return options.getLab ? options.getLab(...args) : { version: 4, ram: 32 }; },
    command: async (...args) => { posts.push(['command', ...args]); return options.command ? options.command(...args) : { ...structuredClone(observed), execution: args[2].action === 'provision' ? { replayed: posts.length > 1, operation_id: args[2].operation_id, attempt: attempt({ operation_id: args[2].operation_id }) } : undefined }; },
    verify: async (...args) => { posts.push(['proof', ...args]); if (options.verify) return options.verify(...args); const saved = proof(); history.items.push(saved); return saved; },
  };
  const transitions = { transitionCase: async (_wid, _cid, body) => { posts.push(['transition', body]); if (options.transition) return options.transition(body); detail.case = { ...detail.case, version: detail.case.version + 1, state: body.action === 'reopen' ? 'investigating' : 'closed' }; observed.case_version = detail.case.version; return structuredClone(detail.case); } };
  const controller = createCasesController({ listCases: async () => ({ items: [], next_cursor: null }), getCase: async () => structuredClone(detail) }, async () => { rechecks++; },
    { addEvidence: async () => { posts.push(['evidence']); return detail.evidence[0]; }, getGraph: async () => options.graph ? options.graph() : graph() }, transitions,
    { getRun: async () => run(), reviewLink: async () => { posts.push(['link']); }, createManualLink: async () => { posts.push(['manual']); } }, service);
  const access = { ...scope(), canVerify: true, canAdmin: true, ...options.scope };
  controller.sync(access, { kind: 'detail', caseId: CID, search: '' }); await tick(); await controller.loadSandbox();
  return { controller, access, posts, reads, rechecks: () => rechecks, setObserved: value => { observed = value; }, setDetail: value => { detail = value; } };
}
test('sandbox schemas enforce command DTOs, minimal proof, legacy history and malformed v2 rejection', () => {
  assert.ok(sandboxSchema.safeParse(sandbox()).success); assert.ok(proofSchema.safeParse(proof()).success);
  const old = sandbox(); old.observation.attempts.push({ checker_version: 'lab-state-1', result: 'passed' }); assert.ok(sandboxSchema.safeParse(old).success);
  old.observation.attempts.push({ checker_version: 'lab-state-2', result: 'passed' }); assert.equal(sandboxSchema.safeParse(old).success, false);
  for (const patch of [{ request_id: 'other' }, { passed: true }, { expected_version: 0 }, { operation_id: 'not-a-uuid' }, { expected_case_version: 0 }]) assert.equal(commandSchema.safeParse({ ...command(), ...patch }).success, false);
  assert.equal(commandSchema.safeParse({ ...command('capacity'), ram: 1.2 }).success, false);
  assert.equal(observationSchema.safeParse({ result: 'passed', delivery: { status: 'delivered', total: 3, delivered: 1 } }).success, false);
});
test('sandbox service sends exact paths/bodies and rejects wrong case/operation and duplicate proof ids', async () => {
  let data = sandbox(); const calls = [], signal = new AbortController().signal;
  const send = async (...args) => { calls.push(args); return { data }; };
  const service = createSandboxService({ get: send, post: send });
  await service.getSandbox(WID, CID, signal); assert.equal(calls.at(-1)[0], `/api/v1/workspaces/${WID}/cases/${CID}/sandbox`);
  data = { ...sandbox(), execution: { replayed: false, operation_id: OID, attempt: attempt() } };
  await service.command(WID, CID, command(), signal); assert.deepEqual(calls.at(-1)[1], command()); assert.equal(calls.at(-1)[2].signal, signal);
  data = proof(); await service.verify(WID, CID, signal); assert.deepEqual(calls.at(-1)[1], {}); assert.ok(calls.at(-1)[0].endsWith('/verifications'));
  data = proofs([proof()]); await service.getProofs(WID, CID, signal); assert.equal(calls.at(-1)[1].signal, signal);
  data = { version: 4, ram: 32, requests: [], events: [] }; assert.deepEqual(await service.getLab(WID, signal), { version: 4, ram: 32 });
  data = sandbox({ case_id: CID2 }); await assert.rejects(service.getSandbox(WID, CID), { code: 'INVALID_API_RESPONSE' });
  data = proofs([proof(), proof()]); await assert.rejects(service.getProofs(WID, CID), { code: 'INVALID_API_RESPONSE' });
  data = { ...sandbox(), execution: { replayed: true, operation_id: 'other', attempt: attempt({ operation_id: 'other' }) } };
  await assert.rejects(service.command(WID, CID, command()), { code: 'INVALID_API_RESPONSE' });
});
test('LAB errors only expose known safe reasons, never arbitrary backend text', () => {
  const error = message => new AxiosError('raw', 'HTTP', undefined, undefined, { status: 409, headers: {}, data: { error: { code: 'LAB_COMMAND_REJECTED', message } } });
  assert.match(sandboxFailure(error('VERSION_CONFLICT')).message, /Phiên bản nguồn/);
  assert.equal(sandboxFailure(error('<script>secret</script>')).message.includes('secret'), false);
});
test('sandbox uses role-specific rights and closed cases are read-only', async () => {
  for (const role of ['viewer', 'admin', 'operator', 'reviewer', 'closed']) {
    const x = await setup({ closed: role === 'closed', scope: { canAdmin: role === 'admin', canWrite: ['operator', 'reviewer', 'closed'].includes(role), canVerify: role === 'reviewer' } });
    await x.controller.submitSandboxCommand(command('capacity'));
    assert.equal(x.posts.length, role === 'admin' ? 1 : 0);
    x.controller.beginSandboxIntent(); const before = x.posts.length;
    await x.controller.submitSandboxCommand(command());
    assert.equal(x.posts.length - before, ['operator', 'reviewer'].includes(role) ? 1 : 0);
    x.controller.beginSandboxIntent(); const count = x.posts.length;
    await x.controller.saveSandboxProof(); assert.equal(x.posts.length - count, role === 'reviewer' ? 1 : 0);
    x.controller.stop();
  }
});
test('stale versions/resource mismatch never POST and require explicit reconciliation', async () => {
  const x = await setup();
  await x.controller.submitSandboxCommand({ ...command(), expected_version: 3 });
  assert.equal(x.posts.length, 0); assert.equal(x.controller.getSnapshot().sandbox.mutation.status, 'conflict');
  await x.controller.submitSandboxCommand(command()); assert.equal(x.posts.length, 0);
  x.controller.beginSandboxIntent();
  await x.controller.submitSandboxCommand({ action: 'image', image_id: 'wrong', available: true, expected_case_version: 1, expected_version: 4 });
  assert.equal(x.posts.length, 0);
});
test('uncertain provision reconciles without auto replay and explicit retry preserves the entire old body', async () => {
  let attempts = 0;
  const x = await setup({ command: async (_wid, _cid, body) => {
    if (++attempts === 1) throw new ApiError({ kind: 'timeout', code: 'TIMEOUT', message: 'Safe' });
    return { ...sandbox(), execution: { replayed: true, operation_id: body.operation_id, attempt: attempt({ operation_id: body.operation_id }) } };
  } });
  await x.controller.loadCaseRun();
  const oldRun = x.controller.getSnapshot().snapshot;
  await x.controller.submitSandboxCommand(command());
  assert.equal(x.posts.length, 1); assert.equal(x.controller.getSnapshot().sandbox.mutation.status, 'uncertain');
  const changed = sandbox(); changed.observation.source_version = 99; x.setObserved(changed); await x.controller.loadSandbox();
  await x.controller.retrySandboxProvision();
  assert.equal(x.posts.length, 2); assert.deepEqual(x.posts[0][3], x.posts[1][3]);
  assert.equal(x.controller.getSnapshot().sandbox.mutation.execution.replayed, true);
  assert.equal(x.controller.getSnapshot().sandbox.snapshot.data.observation.source_version, 99);
  assert.equal(x.controller.getSnapshot().snapshot, oldRun);
  assert.ok(oldRun.graph);
});

test('closing retains pending-link and BE proof guards; reopening reloads source and makes old case-version proof stale', async () => {
  const pending = await setup();
  await pending.controller.submitTransition({ action: 'verify_close', expected_version: 1, reason: 'reviewed' });
  assert.equal(pending.posts.length, 0);
  const denied = await setup({ graph: () => ({ ...graph(), links: [] }), transition: async () => { throw failure('VERIFICATION_REQUIRED'); } });
  await denied.controller.submitTransition({ action: 'verify_close', expected_version: 1, reason: 'reviewed' });
  assert.equal(denied.controller.getSnapshot().workflow.error.code, 'VERIFICATION_REQUIRED');
  assert.equal(denied.controller.getSnapshot().detail.data.case.state, 'awaiting_verification');
  const saved = proof();
  const reopened = await setup({ closed: true, getProofs: async () => proofs([saved]) });
  await reopened.controller.submitTransition({ action: 'reopen', expected_version: 1, reason: 'needs a new check' });
  const state = reopened.controller.getSnapshot();
  assert.equal(state.detail.data.case.version, 2);
  assert.equal(state.sandbox.snapshot.data.case_version, 2);
  assert.equal(state.sandbox.proofs.data.items[0], saved);
  assert.match(proofNotice(saved, state.sandbox.snapshot.data, 2), /Khác phiên bản/);
});

test('denied read purges before another slow module completes', async () => {
  const gate = Promise.withResolvers(); let deny = false;
  const x = await setup({ getSandbox: async () => deny ? gate.promise : sandbox(), getProofs: async () => { if (deny) throw failure('DENIED', 403); return proofs(); } });
  deny = true; const task = x.controller.loadSandbox(); await tick();
  assert.equal(x.controller.getSnapshot().status, 'blocked');
  assert.equal(x.controller.getSnapshot().sandbox.snapshot.data, null);
  gate.resolve(sandbox()); await task;
});
test('uncertain provision cannot be discarded until its operation is found, capacity/proof never auto POST again', async () => {
  for (const kind of ['provision', 'capacity', 'proof']) {
    const unavailable = async () => { throw failure('ADMIN_UNAVAILABLE', 503); };
    const x = await setup({ command: unavailable, verify: unavailable });
    const noAttempt = sandbox(); noAttempt.observation.attempts = []; x.setObserved(noAttempt); await x.controller.loadSandbox();
    if (kind === 'proof') await x.controller.saveSandboxProof(); else await x.controller.submitSandboxCommand(command(kind));
    assert.equal(x.posts.length, 1); assert.equal(x.controller.getSnapshot().sandbox.mutation.status, 'uncertain');
    x.controller.beginSandboxIntent();
    assert.equal(x.controller.getSnapshot().sandbox.mutation.status, kind === 'provision' ? 'uncertain' : 'idle');
  }
});
test('proof 201 failed/inconclusive is only a saved snapshot, not passed/closed, and history remains immutable', async () => {
  for (const result of ['failed', 'inconclusive', 'passed']) {
    const saved = proof({ observation: { result } });
    const x = await setup({ verify: async () => saved, getProofs: async () => proofs([saved]) });
    await x.controller.saveSandboxProof();
    assert.equal(x.controller.getSnapshot().sandbox.mutation.savedProof.observation.result, result);
    assert.equal(x.controller.getSnapshot().detail.data.case.state, 'awaiting_verification');
    assert.equal(x.posts.length, 1);
  }
  assert.match(proofNotice(proof(), sandbox(), 2), /Khác phiên bản/);
  assert.match(proofNotice(proof({ observation: sandbox().observation }), sandbox(), 1), /chưa ghi nhận đủ log/);
});
test('shared write lock prevents command/proof/workflow/evidence overlap and permits saved-run reads during sandbox GET', async () => {
  const gate = Promise.withResolvers();
  const x = await setup({ command: () => gate.promise });
  const write = x.controller.submitSandboxCommand(command()); await tick();
  await x.controller.submitSandboxCommand(command()); await x.controller.saveSandboxProof();
  await x.controller.submitTransition({ action: 'verify_close', reason: 'done', expected_version: 1 });
  await x.controller.submitEvidence({ kind: 'note', note: 'hello', event_ids: [] });
  assert.equal(x.posts.length, 1);
  gate.resolve({ ...sandbox(), execution: { replayed: false, operation_id: OID, attempt: attempt() } }); await write;
  const pending = Promise.withResolvers();
  let first = true;
  const y = await setup({ getSandbox: async () => first ? (first = false, sandbox()) : pending.promise });
  const read = y.controller.loadSandbox(); await y.controller.loadCaseRun();
  assert.equal(y.controller.getSnapshot().caseRun.status, 'ready');
  pending.resolve(sandbox()); await read;
});
test('module errors preserve investigation, 401/403/404 purge immediately, scope changes reject late reads and writes', async () => {
  const x = await setup({ getSandbox: async () => { throw failure('SANDBOX_BINDING_REQUIRED'); } });
  assert.equal(x.controller.getSnapshot().status, 'active'); assert.ok(x.controller.getSnapshot().detail.data);
  for (const status of [401, 403, 404]) {
    const denied = await setup({ getProofs: async () => { throw failure('DENIED', status); } });
    assert.equal(denied.controller.getSnapshot().status, status === 401 ? 'reauth' : 'blocked');
    assert.equal(denied.controller.getSnapshot().sandbox.snapshot.data, null);
  }
  for (const task of ['read', 'write']) for (const change of ['logout', 'case', 'workspace', 'actor', 'admin']) {
    const gate = Promise.withResolvers(); let wait = false;
    const y = await setup({ getSandbox: async () => wait && task === 'read' ? gate.promise : sandbox(), command: async () => gate.promise });
    wait = true;
    const pending = task === 'read' ? y.controller.loadSandbox() : y.controller.submitSandboxCommand(command()); await tick();
    if (change === 'logout') y.controller.stop();
    else y.controller.sync({ ...y.access, ...(change === 'workspace' ? { workspaceId: CID2 } : change === 'actor' ? { subject: 'other' } : change === 'admin' ? { canAdmin: false } : {}) }, { kind: 'detail', caseId: change === 'case' ? CID2 : CID, search: '' });
    gate.resolve(sandbox()); await pending; await tick();
    assert.equal(y.controller.getSnapshot().sandbox.snapshot.data, null);
    assert.equal(y.controller.getSnapshot().sandbox.mutation.intent, null);
  }
});
