import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCasesController } from '../src/features/cases/state/controller.ts';
import { ApiError } from '../src/services/apiError.ts';
import { caseDetail, CID, CID2 } from './case-fixtures.mjs';
import { scope, EID, EID2 } from './event-fixtures.mjs';
import { graph, run, RID } from './reconstruction-fixtures.mjs';

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const error = (status, code = 'DENIED') => new ApiError({ kind: status === 401 ? 'auth' : 'http', status, code, message: 'Safe error' });
async function setup(options = {}) {
  let detail = caseDetail(), currentGraph = graph(), rechecks = 0;
  const calls = [], signals = [];
  const controller = createCasesController({
    listCases: async () => ({ items: [], next_cursor: null }),
    getCase: async () => structuredClone(detail),
  }, async () => { rechecks++; }, {
    addEvidence: async () => { throw Error('not expected'); },
    getGraph: async (wid, rid, signal) => { calls.push(['graph', wid, rid]); signals.push(signal); return options.getGraph ? options.getGraph(signal) : structuredClone(currentGraph); },
  }, undefined, {
    getRun: async (wid, rid, signal) => { calls.push(['run', wid, rid]); signals.push(signal); return options.getRun ? options.getRun(signal) : run('completed'); },
    reviewLink: async (...args) => {
      calls.push(['review', ...args]);
      if (options.review) return options.review(...args);
      currentGraph.links[0].version++; currentGraph.links[0].review_state = 'accepted';
    },
    createManualLink: async (...args) => { calls.push(['manual', ...args]); },
  });
  const access = { ...scope(), canVerify: true, ...options.access };
  const view = { kind: 'detail', caseId: CID, search: '?tab=reconstruction' };
  controller.sync(access, view); await tick();
  return { controller, access, view, calls, signals, rechecks: () => rechecks, setDetail: d => { detail = d; } };
}
const reviewBody = { decision: 'accepted', reason: 'Đã đối chiếu', expected_version: 1 };

test('saved run GETs exact case run, shares graph with evidence/pending count; no run creation', async () => {
  const x = await setup(); await x.controller.loadCaseRun();
  assert.deepEqual(x.calls.map(c => c[0]), ['run', 'graph']);
  assert.ok(x.calls.every(c => c[2] === RID));
  const state = x.controller.getSnapshot();
  assert.equal(state.snapshot.events, state.snapshot.graph.nodes);
  assert.equal(state.workflowGraph.pendingCount, state.snapshot.graph.links.filter(l => l.review_state === 'pending').length);
  await x.controller.reviewCaseLink(state.snapshot.graph.links[0].id, reviewBody);
  assert.equal(x.calls.filter(c => c[0] === 'review').length, 1);
  assert.equal(x.controller.getSnapshot().workflowGraph.pendingCount, 0);
  assert.equal(x.controller.getSnapshot().snapshot.graph.links[0].version, 2);
});

test('viewer/admin read saved run and closed snapshots but never mutate', async () => {
  for (const access of [{ canWrite: false }, { canWrite: false, canVerify: false }]) {
    const x = await setup({ access }); await x.controller.loadCaseRun();
    await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
    await x.controller.createCaseManualLink({ from_event_id: EID, to_event_id: EID2, reason: 'new' });
    assert.ok(x.controller.getSnapshot().snapshot.graph);
    assert.equal(x.calls.filter(c => ['review', 'manual'].includes(c[0])).length, 0);
  }
  const x = await setup(); x.setDetail({ ...caseDetail(), case: { ...caseDetail().case, state: 'closed' } });
  await x.controller.refresh(); await x.controller.loadCaseRun();
  await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
  assert.ok(x.controller.getSnapshot().snapshot.graph);
  assert.equal(x.calls.filter(c => c[0] === 'review').length, 0);
});

test('fresh case preflight prevents editing newly closed case; stale version cannot POST', async () => {
  const x = await setup(); await x.controller.loadCaseRun();
  await x.controller.reviewCaseLink(graph().links[0].id, { ...reviewBody, expected_version: 20 });
  assert.equal(x.controller.getSnapshot().linkMutation.status, 'conflict');
  x.setDetail({ ...caseDetail(), case: { ...caseDetail().case, state: 'closed' } });
  await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
  assert.equal(x.controller.getSnapshot().linkMutation.status, 'locked');
  assert.equal(x.calls.filter(c => c[0] === 'review').length, 0);
});

test('uncertain POST refetches graph exactly once without replay; double click blocked', async () => {
  const gate = deferred(); const x = await setup({ review: () => gate.promise });
  await x.controller.loadCaseRun();
  const first = x.controller.reviewCaseLink(graph().links[0].id, reviewBody); await tick();
  await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
  gate.resolve(Promise.reject(error(503, 'HTTP_503'))); await first;
  assert.equal(x.calls.filter(c => c[0] === 'review').length, 1);
  assert.equal(x.calls.filter(c => c[0] === 'graph').length, 2);
  assert.equal(x.controller.getSnapshot().linkMutation.status, 'uncertain');
});

test('401/403/404 purge run, graph and evidence without auto replay', async () => {
  for (const status of [401, 403, 404]) {
    const x = await setup({ review: async () => { throw error(status); } }); await x.controller.loadCaseRun();
    await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
    assert.equal(x.controller.getSnapshot().caseRun.run, null);
    assert.equal(x.controller.getSnapshot().snapshot.graph, undefined);
    assert.deepEqual(x.controller.getSnapshot().snapshot.events, []);
    assert.equal(x.rechecks(), status === 401 ? 0 : 1);
  }
});

test('logout, permission refresh and route changes abort and ignore late saved runs', async () => {
  for (const change of ['logout', 'access', 'route']) {
    const gate = deferred(); const x = await setup({ getRun: () => gate.promise });
    const work = x.controller.loadCaseRun(); await tick();
    if (change === 'logout') x.controller.stop();
    else x.controller.sync(change === 'access' ? { ...x.access, accessKey: {} } : x.access, change === 'route' ? { ...x.view, caseId: CID2 } : x.view);
    gate.resolve(run('completed')); await work;
    assert.equal(x.signals[0].aborted, true);
    assert.equal(x.controller.getSnapshot().caseRun.run, null);
    assert.equal(x.calls.filter(c => c[0] === 'graph').length, 0);
  }
});

test('wrong run, graph and terminal failure do not publish a snapshot', async () => {
  for (const options of [{ getRun: async () => ({ ...run('completed'), id: CID2 }) }, { getGraph: async () => ({ ...graph(), run_id: CID2 }) }, { getRun: async () => run('failed') }]) {
    const x = await setup(options); await x.controller.loadCaseRun();
    assert.equal(x.controller.getSnapshot().snapshot.graph, undefined);
  }
});

test('case run change during preflight purges original graph and never POSTs against it', async () => {
  const x = await setup(); await x.controller.loadCaseRun();
  x.setDetail({ ...caseDetail(), case: { ...caseDetail().case, run_id: CID2 } });
  await x.controller.reviewCaseLink(graph().links[0].id, reviewBody);
  assert.equal(x.calls.filter(c => c[0] === 'review').length, 0);
  assert.equal(x.controller.getSnapshot().detail.data.case.run_id, CID2);
  assert.equal(x.controller.getSnapshot().snapshot.graph, undefined);
  assert.equal(x.controller.getSnapshot().caseRun.run, null);
});
