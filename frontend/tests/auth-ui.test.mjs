import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('auth UI renders loading, session failure, login/logout, and callback feedback', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false } })
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/features/auth/authContext.ts')
    const { HomePage } = await server.ssrLoadModule('/src/pages/HomePage.tsx')
    const { AuthCallbackPage } = await server.ssrLoadModule('/src/pages/AuthCallbackPage.tsx')
    const { WorkspaceContext } = await server.ssrLoadModule('/src/features/workspace/workspaceContext.ts')
    const { initialWorkspaceState } = await server.ssrLoadModule('/src/features/workspace/state.ts')
    const workspace = {
      state: initialWorkspaceState(), membership: null,
      permissions: { canRead: false, canWrite: false, canVerify: false },
      selectWorkspace: () => false, refreshAccess: async () => {}, loadMoreSources: async () => {},
    }
    const actions = { signIn: async () => {}, signOut: async () => {}, getAccessToken: async () => '' }
    function render(state, page = HomePage) {
      return renderToString(createElement(AuthContext.Provider, { value: { ...actions, state } },
        createElement(WorkspaceContext.Provider, { value: workspace },
          createElement(MemoryRouter, null, createElement(page)))))
    }
    const loading = render({ status: 'initializing' })
    assert.match(loading, /role="status"/)
    assert.match(loading, /Đang kiểm tra phiên/)
    assert.doesNotMatch(loading, /<button/)
    const signedOut = render({ status: 'unauthenticated', message: 'Phiên đã hết hạn.' })
    assert.match(signedOut, /Phiên đã hết hạn/)
    assert.match(signedOut, /Đăng nhập/)
    assert.doesNotMatch(signedOut, /Đăng xuất/)
    const signedIn = render({ status: 'authenticated' })
    assert.match(signedIn, /Đã đăng nhập/)
    assert.match(signedIn, /Đăng xuất/)
    const error = render({ status: 'error', reason: 'initialization', message: 'Không thể xác thực phiên.' })
    assert.match(error, /role="alert"/)
    assert.match(error, /Tải lại trang/)
    const callback = render({ status: 'unauthenticated' }, AuthCallbackPage)
    assert.match(callback, /Đăng nhập chưa hoàn tất hoặc đã bị hủy/)
    assert.match(callback, /Về trang chủ/)
  } finally {
    await server.close()
  }
})
