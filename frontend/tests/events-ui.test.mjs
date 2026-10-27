import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { event, scope, WID, SID } from './event-fixtures.mjs'

test('events UI renders filters, outcomes, precision, provenance, escaped payload and role-gated root', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false } })
  try {
    const { EventsExplorer } = await server.ssrLoadModule('/src/features/events/EventsExplorer.tsx')
    const { EventsContext } = await server.ssrLoadModule('/src/features/events/eventsContext.ts')
    const { WorkspaceContext } = await server.ssrLoadModule('/src/features/workspace/workspaceContext.ts')
    const { AuthContext } = await server.ssrLoadModule('/src/features/auth/authContext.ts')
    const { initialEventsState } = await server.ssrLoadModule('/src/features/events/state.ts')
    const { ApiError } = await server.ssrLoadModule('/src/services/apiError.ts')
    const noop = () => {}
    const actions = { setFilters: noop, showEvent: noop, refresh: noop, previousPage: noop, nextPage: noop, selectRoot: () => true, clearRoot: noop, retryDetail: noop }
    const membership = { workspace_id: WID, roles: ['operator'], group_ids: [] }
    const initial = initialEventsState(scope())
    const ready = {
      ...initial, list: { status: 'ready', items: [event()], error: null },
      detail: { status: 'ready', event: event(), id: event().event_id, error: null }, nextCursor: 'next',
    }
    function render(state, canWrite = true, authenticated = true) {
      const auth = { state: { status: authenticated ? 'authenticated' : 'unauthenticated' }, signIn: async () => {} }
      const workspace = {
        state: { status: 'ready', me: { subject: 'a', memberships: [membership] }, sources: {
          status: 'ready', items: [{ id: SID, name: 'intake' }], nextCursor: 'next-source',
        } },
        membership, permissions: { canRead: true, canWrite }, loadMoreSources: async () => {},
      }
      return renderToString(createElement(AuthContext.Provider, { value: auth },
        createElement(WorkspaceContext.Provider, { value: workspace },
          createElement(EventsContext.Provider, { value: { ...actions, state } },
            createElement(MemoryRouter, null, createElement(EventsExplorer)))))).replace(/<!--.*?-->/g, '')
    }
    const html = render(ready)
    assert.match(html, /Asia\/Ho_Chi_Minh/)
    assert.match(html, /Tìm kiếm/)
    assert.match(html, /Tải thêm nguồn cho bộ lọc/)
    assert.match(html, /Phân trang events/)
    assert.match(html, /Trước/)
    assert.match(html, /Tiếp/)
    assert.match(html, /success/)
    assert.match(html, /2026-10-26T06:00:00.000001Z/)
    assert.match(html, /Batch ID/)
    assert.match(html, /events\[1\]/)
    assert.match(html, /a{64}/)
    assert.match(html, /Chọn làm root/)
    assert.match(html, /&lt;script&gt;/)
    assert.doesNotMatch(html, /<script>|<img src=x/)
    assert.doesNotMatch(render(ready, false), /Chọn làm root/)
    assert.match(render({ ...ready, root: event() }), /Root đã chọn/)
    assert.match(render({ ...initial, list: { status: 'ready', items: [], error: null } }), /Không có event phù hợp/)
    assert.match(render({ ...initial, list: { status: 'loading', items: [], error: null } }), /Đang tải events/)
    const failure = new ApiError({ kind: 'http', code: 'FORBIDDEN', message: 'Safe error', requestId: 'request-demo' })
    assert.match(render({ ...initial, status: 'blocked', error: failure }), /request-demo/)
    assert.match(render({ ...initial, status: 'invalid-query' }), /Tham số URL không hợp lệ/)
    assert.match(render({ ...initial, status: 'reauth', error: failure }), /Đăng nhập lại/)
    assert.match(render(ready, true, false), /Vui lòng đăng nhập/)
  } finally {
    await server.close()
  }
})
