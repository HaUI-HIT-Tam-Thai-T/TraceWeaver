import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

test('AppShell keeps one main, active cases navigation and safe access states without fetching', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-app-shell', server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const [{ AppLayout }, { WorkspaceAccessState }, { AuthContext }, { WorkspaceContext }, { initialWorkspaceState, activeMembership, workspacePermissions }] = await Promise.all([
      server.ssrLoadModule('/src/components/layout/AppLayout.tsx'),
      server.ssrLoadModule('/src/components/layout/WorkspaceAccessState.tsx'),
      server.ssrLoadModule('/src/features/auth/state/authContext.ts'),
      server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts'),
      server.ssrLoadModule('/src/features/workspace/state/state.ts'),
    ]);
    let actions = 0;
    const action = () => { actions++; };
    const initial = initialWorkspaceState();
    const id = '10000000-0000-4000-8000-000000000001';
    const member = { workspace_id: id, roles: ['viewer'], group_ids: [] };
    const ready = { ...initial, status: 'ready', selectedWorkspaceId: id, me: { subject: 'test', memberships: [member] } };
    function render(state, auth = { status: 'authenticated' }) {
      const membership = activeMembership(state);
      return renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/cases/detail-id'] },
        h(AuthContext.Provider, { value: { state: auth, signIn: action, signOut: action } },
          h(WorkspaceContext.Provider, { value: { state, membership, permissions: workspacePermissions(membership), selectWorkspace: action, refreshAccess: action } },
            h(Routes, null, h(Route, { element: h(AppLayout) },
              h(Route, { element: h(WorkspaceAccessState) }, h(Route, { path: '/cases/:caseId', element: h('h1', null, 'Protected payload') }))))))));
    }
    const allowed = render(ready);
    assert.equal((allowed.match(/<main\b/g) ?? []).length, 1);
    assert.match(allowed, /Protected payload/);
    assert.match(allowed, /aria-current="page"[^>]*href="\/cases"|href="\/cases"[^>]*aria-current="page"/);
    assert.match(allowed, /Bỏ qua điều hướng/);
    assert.match(allowed, /<a(?=[^>]*href="\/dashboard")(?=[^>]*aria-label="TraceWeaver")[^>]*>/);
    assert.match(allowed, /for="workspace-picker"/);
    assert.match(allowed, /data-slot="badge"[^>]*>viewer/);
    assert.match(allowed, /Mở menu điều hướng/);
    const header = allowed.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
    const sidebar = allowed.match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? '';
    assert.doesNotMatch(header, /Đăng xuất|Đã đăng nhập|Làm mới quyền và nguồn/);
    assert.match(sidebar, /<\/nav>[\s\S]*Đăng xuất/);
    assert.match(allowed, /aria-controls="desktop-sidebar"/);
    assert.match(allowed, /aria-expanded="true"/);
    assert.doesNotMatch(header, /Thu gọn thanh bên/);
    assert.match(allowed, /Thu gọn thanh bên/);
    assert.match(allowed, /data-collapsed="false"/);
    assert.doesNotMatch(render(ready, { status: 'unauthenticated' }).match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? '', /Đăng xuất/);
    assert.equal((allowed.match(/id="workspace-picker"/g) ?? []).length, 1);
    for (const [state, auth, expected] of [
      [ready, { status: 'unauthenticated' }, /Vui lòng đăng nhập/],
      [ready, { status: 'initializing' }, /Đang kiểm tra phiên/],
      [ready, { status: 'error', reason: 'initialization', message: 'Lỗi phiên an toàn.' }, /Tải lại trang/],
      [{ ...initial, status: 'loading' }, undefined, /Đang kiểm tra workspace/],
      [{ ...ready, selectedWorkspaceId: null }, undefined, /Vui lòng chọn workspace/],
      [{ ...ready, me: { subject: 'test', memberships: [] }, selectedWorkspaceId: null }, undefined, /chưa được cấp workspace/],
      [{ ...ready, selectedWorkspaceId: 'other-workspace' }, undefined, /chưa có quyền đọc/],
      [{ ...ready, me: { subject: 'test', memberships: [{ ...member, roles: ['ingest_service'] }] } }, undefined, /chưa có quyền đọc/],
      [{ ...initial, status: 'error', error: { message: 'Mất kết nối', requestId: 'request-test' } }, undefined, /Thử lại/],
      [{ ...initial, status: 'reauth', error: { message: 'Hết phiên' } }, undefined, /Đăng nhập lại/],
    ]) {
      const html = render(state, auth);
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      assert.match(html, expected);
      assert.doesNotMatch(html, /Protected payload/);
      assert.match(html, /aria-label="Thanh bên"/);
    }
    const revalidating = render({ ...initial, status: 'loading' });
    assert.doesNotMatch(revalidating, new RegExp(id));
    assert.doesNotMatch(revalidating, />viewer</);
    assert.match(revalidating, /disabled=""/);
    // A source/grant failure does not itself block other workspace pages.
    assert.match(render({ ...ready, sources: { ...initial.sources, status: 'error', error: { message: 'Source denied' } } }), /Protected payload/);
    assert.equal(actions, 0, 'Rendering header/guard must not trigger auth, workspace selection or refresh');
  } finally { await server.close(); }
});
