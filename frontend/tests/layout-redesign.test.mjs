import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { caseDetail } from './case-fixtures.mjs';

test('compact navigation remains accessible, time filters expose errors, and panel drafts retain version', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-layout-redesign', server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const [{ AppSidebar }, { AuthContext }, { WorkspaceContext }, { FilterTimeRange }, { PageSizeSelect }, { MemberForm }, { CaseDetailView }, { CaseOverview }] = await Promise.all([
      server.ssrLoadModule('/src/components/layout/AppSidebar.tsx'), server.ssrLoadModule('/src/features/auth/state/authContext.ts'), server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts'),
      server.ssrLoadModule('/src/components/ui/FilterTimeRange.tsx'), server.ssrLoadModule('/src/components/ui/PageSizeSelect.tsx'),
      server.ssrLoadModule('/src/features/workspace-admin/components/AdminForms.tsx'), server.ssrLoadModule('/src/features/cases/components/CaseDetailView.tsx'), server.ssrLoadModule('/src/features/cases/components/CaseDetailView.tsx'),
    ]);
    const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/cases'] }, h(AuthContext.Provider, { value: { state: { status: 'authenticated' }, signOut: async () => {} } },
      h(WorkspaceContext.Provider, { value: { permissions: { canAdmin: true } } }, h(AppSidebar, { collapsed: true })))));
    for (const label of ['Tổng quan', 'Sự kiện', 'Hồ sơ', 'Tri thức', 'Quản trị workspace']) assert.ok(html.includes(`aria-label="${label}"`));
    assert.match(html, /aria-current="page"/); assert.match(html, /class="sr-only">Hồ sơ/); assert.doesNotMatch(html, /inert=/);
    // Tooltip must preserve NavLink's className callback and its visible colors.
    for (const collapsed of [false, true]) {
      const sidebar = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/workspace-admin'] }, h(AuthContext.Provider, { value: { state: { status: 'authenticated' }, signOut: async () => {} } },
        h(WorkspaceContext.Provider, { value: { permissions: { canAdmin: true } } }, h(AppSidebar, { collapsed })))));
      const anchors = [...sidebar.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
      assert.equal(anchors.length, 5);
      for (const anchor of anchors) {
        assert.match(anchor, /class="[^"]*flex min-h-11/);
        assert.match(anchor, /text-chrome-muted|text-white/);
        assert.ok(anchor.includes(collapsed ? 'justify-center' : 'px-3'));
      }
      assert.match(anchors.find(anchor => anchor.includes('aria-current="page"')), /bg-chrome-active font-semibold text-white/);
    }
    const collapsed = renderToStaticMarkup(h(FilterTimeRange, { id: 'time' }, h('input', { name: 'from', defaultValue: 'draft-time' })));
    assert.match(collapsed, /aria-expanded="false"/); assert.match(collapsed, /name="from"[^>]*value="draft-time"/);
    const errors = renderToStaticMarkup(h(FilterTimeRange, { id: 'time', hasError: true }, h('p', { role: 'alert' }, 'Lỗi thời gian')));
    assert.match(errors, /aria-expanded="true"/); assert.match(errors, /Lỗi thời gian/);
    const limit = renderToStaticMarkup(h(PageSizeSelect, { id: 'size', value: 100, label: 'Số dòng', disabled: false, onChange() {} }));
    assert.match(limit, /for="size"/); assert.match(limit, /value="100" selected=""/);
    const draft = { subject: 'opaque-id', roles: ['reviewer'], active: false, expected_version: 3 };
    const form = renderToStaticMarkup(h(MemberForm, { draft, member: { subject: 'opaque-id', roles: ['viewer'], active: true, direct_source_ids: [] }, version: 7, disabled: false, controller: {}, hideTitle: true }));
    assert.match(form, /Dùng phiên bản quản trị mới/); assert.match(form, /Đang dùng 3; dữ liệu vừa đọc: 7/);
    assert.doesNotMatch(form, /<h2/);
    const detail = renderToStaticMarkup(h(CaseDetailView, { detail: caseDetail(), showOverview: false }));
    assert.doesNotMatch(detail, /aria-label="Thông tin case"/);
    assert.match(renderToStaticMarkup(h(CaseOverview, { item: caseDetail().case })), /Việc tiếp theo/);
  } finally { await server.close(); }
});
