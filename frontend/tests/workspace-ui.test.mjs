import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('workspace access guard and sources render pagination, escaped content, and safe recovery', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-workspace', server: { middlewareMode: true, hmr: false, ws: false } })
  try {
    const { WorkspaceAccessState } = await server.ssrLoadModule('/src/components/layout/WorkspaceAccessState.tsx')
    const { WorkspacePanel } = await server.ssrLoadModule('/src/features/workspace/components/WorkspacePanel.tsx')
    const { WorkspaceContext } = await server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts')
    const { AuthContext } = await server.ssrLoadModule('/src/features/auth/state/authContext.ts')
    const { initialWorkspaceState, workspacePermissions, activeMembership } = await server.ssrLoadModule('/src/features/workspace/state/state.ts')
    const { ApiError } = await server.ssrLoadModule('/src/services/apiError.ts')
    const id = '10000000-0000-4000-8000-000000000001'
    const membership = { workspace_id: id, roles: ['admin'], group_ids: [] }
    const initial = initialWorkspaceState()
    const ready = { ...initial, status: 'ready', me: { subject: 'user-a', memberships: [membership] }, selectedWorkspaceId: id }
    function render(state, authenticated = true) {
      const selected = activeMembership(state)
      const workspace = {
        state, membership: selected, permissions: workspacePermissions(selected),
        selectWorkspace: () => true, refreshAccess: async () => {}, loadMoreSources: async () => {},
      }
      const auth = { state: { status: authenticated ? 'authenticated' : 'unauthenticated' }, signIn: async () => {} }
      return renderToString(createElement(AuthContext.Provider, { value: auth },
        createElement(WorkspaceContext.Provider, { value: workspace }, createElement(WorkspaceAccessState, null, createElement(WorkspacePanel))))).replace(/<!--.*?-->/g, '')
    }
    assert.match(render(ready, false), /Vui lòng đăng nhập/)
    assert.match(render({ ...initial, status: 'loading' }), /Đang kiểm tra workspace/)
    assert.match(render({ ...ready, me: { subject: 'a', memberships: [] }, selectedWorkspaceId: null }), /Tài khoản chưa được cấp workspace/)
    const unselected = render({ ...ready, selectedWorkspaceId: null })
    assert.match(unselected, /Vui lòng chọn workspace/)
    assert.doesNotMatch(unselected, new RegExp(id))
    const empty = render({ ...ready, sources: { ...initial.sources, status: 'ready' } })
    assert.match(empty, /Chưa có nguồn nào/)
    const populated = render({ ...ready, sources: {
      status: 'ready', items: [{ id: 'source-a', name: '<script>unsafe</script>', service: 'intake', parser_version: 'v1' }],
      nextCursor: 'opaque', error: null,
    } })
    assert.match(populated, /Tải thêm nguồn/)
    assert.match(populated, /<h2[^>]*id="sources-title"[^>]*>Nguồn được phép đọc<\/h2>/)
    assert.match(populated, /<code[^>]*>source-a<\/code>/)
    assert.match(populated, /<caption[^>]*>Danh sách nguồn được phép đọc<\/caption>/)
    assert.match(populated, /<th[^>]*scope="col"[^>]*>Service<\/th>/)
    assert.match(populated, /&lt;script&gt;/)
    assert.doesNotMatch(populated, /<script>/)
    const failure = new ApiError({ kind: 'http', status: 403, code: 'FORBIDDEN', message: 'Không có quyền.', requestId: 'request-demo' })
    const denied = render({ ...ready, sources: { ...initial.sources, status: 'error', error: failure } })
    assert.match(denied, /role="alert"/)
    assert.match(denied, /request-demo/)
    assert.match(denied, /Thử lại/)
    const reauth = render({ ...initial, status: 'reauth', error: failure })
    assert.match(reauth, /Đăng nhập lại/)
    assert.doesNotMatch(reauth, /workspace-picker/)
    assert.match(render({ ...initial, status: 'error', error: failure }), /Thử lại/)
  } finally {
    await server.close()
  }
})
