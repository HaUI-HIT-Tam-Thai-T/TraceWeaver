import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCasesService } from '../src/features/cases/services/createCasesService.ts';
import { createCasesController } from '../src/features/cases/state/controller.ts';
import { caseAssigneesSchema } from '../src/features/cases/schemas.ts';
import { membershipSchema } from '../src/features/workspace/schemas.ts';
import { transitionSchema } from '../src/features/cases/workflow.ts';
import { ApiError } from '../src/services/apiError.ts';
import { caseDetail, CID, CID2 } from './case-fixtures.mjs';
import { scope, WID } from './event-fixtures.mjs';

const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const candidate = { subject: 'opaque/idp|subject:123', roles: ['operator', 'reviewer'] };
const body = { action: 'assign', owner_id: candidate.subject, reason: 'Phân công xử lý', expected_version: 1 };
const error = status => new ApiError({ kind: status === 401 ? 'auth' : 'http', status, code: `HTTP_${status}`, message: 'Safe error' });

async function setup(options = {}) {
  let detail = caseDetail(), reads = 0, lists = 0, rechecks = 0;
  const signals = [], posts = [];
  const controller = createCasesController({
    listCases: async () => ({ items: [], next_cursor: null }),
    getCase: async () => { reads++; return structuredClone(detail); },
  }, async () => { rechecks++; }, undefined, {
    listAssignees: async (wid, cid, signal) => {
      lists++; signals.push(signal);
      assert.equal(wid, WID); assert.ok([CID, CID2].includes(cid));
      return options.list ? options.list(lists, signal) : { items: [candidate] };
    },
    transitionCase: async (...args) => {
      posts.push(args);
      if (options.post) return options.post(...args);
      detail.case = { ...detail.case, state: 'assigned', owner_id: args[2].owner_id, version: 2 };
      return structuredClone(detail.case);
    },
  });
  const access = { ...scope(), canWrite: true, ...options.access };
  const view = { kind: 'detail', caseId: CID, search: '' };
  controller.sync(access, view); await tick();
  return { controller, access, view, posts, signals, reads: () => reads, lists: () => lists, rechecks: () => rechecks, setDetail: value => { detail = value; } };
}

test('new dev contracts accept opaque subjects, enforce workspace name limit and strict assignees DTO', () => {
  assert.deepEqual(caseAssigneesSchema.parse({ items: [candidate] }).items[0], candidate);
  assert.equal(transitionSchema.parse({ ...body, owner_id: ' opaque/idp|subject:123 ' }).owner_id, ' opaque/idp|subject:123 ');
  for (const value of [{ items: [{ ...candidate, display_name: 'guessed' }] }, { items: [{ ...candidate, subject: '' }] }, { items: [{ ...candidate, roles: ['operator', 'operator'] }] }, { items: [{ ...candidate, roles: ['owner'] }] }, { items: [], next_cursor: null }]) assert.equal(caseAssigneesSchema.safeParse(value).success, false);
  const member = { workspace_id: WID, roles: ['operator'], group_ids: [] };
  assert.ok(membershipSchema.safeParse({ ...member, workspace_name: 'x'.repeat(200) }).success);
  assert.equal(membershipSchema.safeParse({ ...member, workspace_name: 'x'.repeat(201) }).success, false);
});

test('assignees service sends scoped GET without pagination/query/body and rejects invalid response/ID', async () => {
  const calls = []; let data = { items: [candidate] };
  const service = createCasesService({ get: async (...args) => { calls.push(args); return { data }; } });
  const signal = new AbortController().signal;
  assert.deepEqual(await service.listAssignees(WID, CID, signal), data);
  assert.deepEqual(calls[0], [`/api/v1/workspaces/${WID}/cases/${CID}/assignees`, { signal }]);
  await assert.rejects(service.listAssignees('bad', CID), { code: 'INVALID_CASE_INPUT' });
  data = { items: [{ ...candidate, email: 'outside-contract' }] };
  await assert.rejects(service.listAssignees(WID, CID), { code: 'INVALID_API_RESPONSE' });
});

test('opening list reloads, submit revalidates candidate, success refreshes case/version and clears candidates', async () => {
  const x = await setup();
  assert.equal(x.lists(), 0);
  await x.controller.loadCaseAssignees(); await x.controller.loadCaseAssignees();
  assert.equal(x.lists(), 2);
  await x.controller.submitTransition(body);
  assert.equal(x.lists(), 3); assert.equal(x.posts.length, 1);
  assert.deepEqual(x.posts[0][2], body);
  assert.equal(x.controller.getSnapshot().detail.data.case.owner_id, candidate.subject);
  assert.equal(x.controller.getSnapshot().detail.data.case.version, 2);
  assert.deepEqual(x.controller.getSnapshot().assignees.items, []);
});

test('candidate revoked since selection or noneligible roles prevent POST using fresh list', async () => {
  for (const items of [[], [{ ...candidate, roles: ['admin'] }], [{ ...candidate, roles: ['viewer'] }]]) {
    const x = await setup({ list: async n => ({ items: n === 1 ? [candidate] : items }) });
    await x.controller.loadCaseAssignees(); await x.controller.submitTransition(body);
    assert.equal(x.posts.length, 0);
    assert.equal(x.controller.getSnapshot().workflow.error.code, 'ASSIGNEE_UNAVAILABLE');
  }
});

test('viewers and non-new cases do not fetch candidate list', async () => {
  const viewer = await setup({ access: { canWrite: false } });
  await viewer.controller.loadCaseAssignees(); await viewer.controller.submitTransition(body);
  assert.equal(viewer.lists(), 0); assert.equal(viewer.posts.length, 0);
  for (const state of ['assigned', 'investigating', 'awaiting_verification', 'closed']) {
    const x = await setup(); const detail = caseDetail(); detail.case.state = state;
    x.setDetail(detail); await x.controller.refresh(); await x.controller.loadCaseAssignees();
    assert.equal(x.lists(), 0);
  }
});

test('assignees denied with 401/403/404 purge all data, server error permits explicit GET retry', async () => {
  for (const status of [401, 403, 404]) {
    const x = await setup({ list: async () => { throw error(status); } });
    await x.controller.loadCaseAssignees();
    assert.equal(x.controller.getSnapshot().detail.data, null);
    assert.deepEqual(x.controller.getSnapshot().assignees.items, []);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
  }
  const x = await setup({ list: async n => { if (n === 1) throw error(503); return { items: [candidate] }; } });
  await x.controller.loadCaseAssignees(); assert.equal(x.controller.getSnapshot().assignees.status, 'error');
  await x.controller.loadCaseAssignees(); assert.equal(x.controller.getSnapshot().assignees.status, 'ready');
});

test('422 transition refetches detail and candidates without resending; 409 requires current version', async () => {
  for (const status of [422, 409]) {
    const x = await setup({ post: async () => { throw error(status); } });
    await x.controller.submitTransition(body);
    assert.equal(x.posts.length, 1); assert.equal(x.reads(), 3);
    assert.equal(x.lists(), status === 422 ? 2 : 1);
    assert.equal(x.controller.getSnapshot().workflow.status, status === 409 ? 'conflict' : 'error');
    await x.controller.submitTransition(body); assert.equal(x.posts.length, 1);
  }
});

test('late candidate responses cannot restore data after logout, scope/case/role changes', async () => {
  for (const change of ['logout', 'workspace', 'case', 'role', 'access']) {
    const gate = deferred(); const x = await setup({ list: () => gate.promise });
    const task = x.controller.loadCaseAssignees(); await tick();
    if (change === 'logout') x.controller.stop();
    else if (change === 'case') x.controller.sync(x.access, { ...x.view, caseId: CID2 });
    else x.controller.sync({ ...x.access, ...(change === 'workspace' ? { workspaceId: CID2 } : change === 'role' ? { canWrite: false } : { accessKey: {} }) }, x.view);
    assert.equal(x.signals[0].aborted, true);
    gate.resolve({ items: [candidate] }); await task; await tick();
    assert.deepEqual(x.controller.getSnapshot().assignees.items, []);
  }
});

test('overlapping list opens coalesce; transition cancels pending list and cannot be restored by its late response', async () => {
  const gate = deferred(); const x = await setup({ list: n => n === 1 ? gate.promise : Promise.resolve({ items: [candidate] }) });
  const task = x.controller.loadCaseAssignees(); await x.controller.loadCaseAssignees(); assert.equal(x.lists(), 1);
  await x.controller.submitTransition(body); assert.equal(x.posts.length, 1); assert.equal(x.signals[0].aborted, true);
  gate.resolve({ items: [candidate] }); await task;
  assert.deepEqual(x.controller.getSnapshot().assignees.items, []);
});
