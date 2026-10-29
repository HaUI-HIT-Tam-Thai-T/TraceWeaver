import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

test('ProtectedRoute blocks children until authenticated without starting login or rendering private code', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-protected-route', server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const { ProtectedRoute } = await server.ssrLoadModule('/src/routes/ProtectedRoute.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/features/auth/state/authContext.ts');
    const { Loader } = await server.ssrLoadModule('/src/components/ui/Loader.tsx');
    let renders = 0, logins = 0;
    function PrivatePage() { renders++; return h('p', null, 'Private case payload'); }
    const auth = { state: { status: 'initializing' }, signIn: async () => { logins++; } };
    function render(state, nested = false) {
      auth.state = state;
      const guarded = nested
        ? h(Routes, null, h(Route, { element: h(ProtectedRoute) }, h(Route, { path: '/cases/:id', element: h(PrivatePage) })))
        : h(ProtectedRoute, null, h(PrivatePage));
      return renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/cases/private-id?tab=reconstruction'] }, h(AuthContext.Provider, { value: auth }, guarded)));
    }
    for (const nested of [false, true]) {
      const pending = render({ status: 'initializing' }, nested);
      assert.match(pending, /Đang kiểm tra phiên đăng nhập/);
      assert.match(pending, /role="status"/);
      assert.match(pending, /motion-safe:animate-spin/);
      assert.doesNotMatch(pending, /Private case payload|Vui lòng đăng nhập|href=/);
      const guest = render({ status: 'unauthenticated', message: 'Phiên đã hết hạn.' }, nested);
      assert.match(guest, /Phiên đã hết hạn/);
      assert.match(guest, /<button[^>]*type="button"[^>]*>Đăng nhập/);
      assert.doesNotMatch(guest, /Private case payload/);
      const initError = render({ status: 'error', reason: 'initialization', message: '<script>error</script>' }, nested);
      assert.match(initError, /Tải lại trang/);
      assert.match(initError, /&lt;script&gt;/);
      assert.doesNotMatch(initError, /Private case payload|<script>/);
      const actionError = render({ status: 'error', reason: 'action', message: 'Không thể đăng nhập' }, nested);
      assert.match(actionError, /Đăng nhập lại/);
      assert.doesNotMatch(actionError, /Private case payload/);
    }
    assert.equal(renders, 0); assert.equal(logins, 0);
    assert.match(render({ status: 'authenticated' }, true), /Private case payload/);
    assert.equal(renders, 1);
    assert.doesNotMatch(render({ status: 'unauthenticated' }, true), /Private case payload/);
    assert.equal(renders, 1);
    const loader = renderToStaticMarkup(h(Loader, { message: 'Đang tải trang…' }));
    assert.match(loader, /aria-live="polite"/);
    assert.match(loader, /aria-atomic="true"/);
    assert.match(loader, /aria-hidden="true"/);
    assert.match(loader, /motion-reduce:animate-none/);
  } finally { await server.close(); }
});
