import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { sandbox, proof, proofs, attempt } from './sandbox-fixtures.mjs';
import { CID, caseDetail } from './case-fixtures.mjs';
import { scope, WID } from './event-fixtures.mjs';

test('sandbox is visible outside canWrite, roles gate actions, historical failures do not override current result and data is escaped', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-sandbox-ui', server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const [{ SandboxPanel, AttemptView }, { initialCasesState }, { CaseDetailPage }, { CasesContext }, { AuthContext }, { WorkspaceContext }] = await Promise.all([
      server.ssrLoadModule('/src/features/case-sandbox/SandboxPanel.tsx'), server.ssrLoadModule('/src/features/cases/state/state.ts'), server.ssrLoadModule('/src/pages/CaseDetailPage.tsx'),
      server.ssrLoadModule('/src/features/cases/state/casesContext.ts'), server.ssrLoadModule('/src/features/auth/state/authContext.ts'), server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts'),
    ]);
    const noop = async () => {};
    const actions = { loadSandbox: noop, submitSandboxCommand: noop, retrySandboxProvision: noop, saveSandboxProof: noop, beginSandboxIntent() {} };
    function stateFor(role, closed = false) {
      const state = initialCasesState({ ...scope(), canAdmin: role === 'admin', canWrite: ['operator', 'reviewer'].includes(role), canVerify: role === 'reviewer' });
      const detail = caseDetail(); detail.case.state = closed ? 'closed' : 'awaiting_verification';
      state.detail = { status: 'ready', id: CID, data: detail, error: null };
      const observed = sandbox(); observed.observation.request_id = '<script>escape</script>'; observed.observation.result = 'passed';
      state.sandbox.snapshot = { status: 'ready', data: observed, error: null };
      state.sandbox.lab = { status: 'ready', data: { version: 4, ram: 32 }, error: null };
      state.sandbox.proofs = { status: 'ready', data: proofs([proof()]), error: null };
      return state;
    }
    for (const role of ['viewer', 'admin', 'operator', 'reviewer']) {
      const state = stateFor(role);
      const html = renderToStaticMarkup(h(SandboxPanel, { state, actions }));
      assert.match(html, /Kiểm chứng nghiệp vụ mô phỏng/); assert.match(html, /32 GB/); assert.match(html, /Nguồn đang ghi nhận: Đạt/);
      assert.match(html, /&lt;script&gt;escape/); assert.doesNotMatch(html, /<script>/);
      assert.equal(html.includes('aria-label="Sửa điều kiện mô phỏng"'), role === 'admin');
      assert.equal(html.includes('>Chạy lại mô phỏng<'), ['operator', 'reviewer'].includes(role));
      assert.equal(html.includes('>Lưu kiểm chứng nguồn<'), role === 'reviewer');
      assert.match(html, /Chưa đủ kết luận/); assert.doesNotMatch(html, /RAM_AVAILABLE<\/li>/);
      const page = renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/cases/${CID}`] },
        h(AuthContext.Provider, { value: { state: { status: 'authenticated' } } },
          h(WorkspaceContext.Provider, { value: { state: { status: 'ready', selectedWorkspaceId: WID, sources: { items: [] } }, permissions: { canRead: true, canWrite: state.scope.canWrite } } },
            h(CasesContext.Provider, { value: { state, ...actions } }, h(Routes, null, h(Route, { path: '/cases/:caseId', element: h(CaseDetailPage) })))))));
      assert.match(page, /aria-label="Kiểm chứng nghiệp vụ mô phỏng"/);
      assert.ok(page.indexOf('class="case-overview') < page.indexOf('aria-label="Kiểm chứng nghiệp vụ mô phỏng"'));
    }
    const closed = renderToStaticMarkup(h(SandboxPanel, { state: stateFor('reviewer', true), actions }));
    for (const label of ['Chạy lại mô phỏng', 'Lưu kiểm chứng nguồn']) assert.match(closed.match(new RegExp(`<button[^>]*>${label}<\\/button>`))?.[0] ?? '', / disabled=""/);
    const legacy = renderToStaticMarkup(h(AttemptView, { attempt: { checker_version: 'lab-state-1', result: 'passed' } }));
    assert.match(legacy, /không dùng để kết luận nguồn hiện tại đạt/);
    const modern = renderToStaticMarkup(h(AttemptView, { attempt: attempt() }));
    assert.match(modern, /Image: Không đạt/); assert.match(modern, /RAM: Đạt/);
  } finally { await server.close(); }
});
