import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { event, scope, WID, SID } from './event-fixtures.mjs'

test('events UI renders filters, outcomes, precision, provenance, escaped payload and role-gated root', async () => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.tmp/ssr-events', server: { middlewareMode: true, hmr: false, ws: false } })
  try {
    const { EventsExplorer } = await server.ssrLoadModule('/src/features/events/components/EventsExplorer.tsx')
    const { EventsContext } = await server.ssrLoadModule('/src/features/events/state/eventsContext.ts')
    const { WorkspaceContext } = await server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts')
    const { AuthContext } = await server.ssrLoadModule('/src/features/auth/state/authContext.ts')
    const { initialEventsState } = await server.ssrLoadModule('/src/features/events/state/state.ts')
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
    assert.match(html, /Phân trang sự kiện/)
    assert.match(html, /Trước/)
    assert.match(html, /Tiếp/)
    assert.match(html, /success/)
    assert.match(html, /2026-10-26T06:00:00.000001Z/)
    assert.match(html, /Batch ID/)
    assert.match(html, /events\[1\]/)
    assert.match(html, /a{64}/)
    assert.match(html, /Chọn làm điểm bắt đầu tái dựng/)
    assert.match(html, /&lt;script&gt;/)
    assert.doesNotMatch(html, /<script>|<img src=x/)
    assert.doesNotMatch(render(ready, false), /Chọn làm điểm bắt đầu tái dựng/)
    assert.match(render({ ...ready, root: event() }), /Điểm bắt đầu tái dựng: example · Đã tiếp nhận yêu cầu/)
    assert.match(render({ ...initial, list: { status: 'ready', items: [], error: null } }), /Không có sự kiện phù hợp/)
    assert.match(render({ ...initial, list: { status: 'loading', items: [], error: null } }), /Đang tải sự kiện/)
    const table = html.match(/<table[\s\S]*?<\/table>/)[0]
    assert.match(table, /Mã yêu cầu/)
    assert.match(table, /example/)
    assert.match(table, /intake/)
    assert.match(table, /Đã tiếp nhận yêu cầu/)
    assert.match(table, /Thành công/)
    assert.match(table, /13:00:00 · 26\/10\/2026/)
    assert.doesNotMatch(table, new RegExp(SID))
    assert.doesNotMatch(table, /<span[^>]*>2026-10-26T/)
    assert.match(html, /<details[^>]*><summary[^>]*>Chi tiết kỹ thuật<\/summary>/)
    assert.doesNotMatch(html, /<details[^>]*\bopen\b/)
    const failed = { ...event(), action: 'provision.failed', outcome: 'failed', payload_redacted: { error_code: 'CAPACITY_EXHAUSTED' } }
    const missing = { ...event('22222222-2222-4222-8222-222222222222'), identifiers: [], source_id: 'unloaded-source', action: 'new.action', outcome: 'unknown', message: '' }
    const mixed = render({ ...initial, list: { status: 'ready', items: [failed, missing], error: null } })
    assert.match(mixed, /Cấp môi trường thất bại/)
    assert.match(mixed, /Thất bại/)
    assert.match(mixed, /Không đủ tài nguyên để cấp môi trường/)
    assert.match(mixed, /Chưa tải được tên nguồn/)
    assert.match(mixed, /Hoạt động chưa có nhãn/)
    assert.match(mixed, /Chưa có nội dung mô tả/)
    assert.match(mixed, /Chưa xác định/)
    assert.doesNotMatch(mixed, /Đang xử lý/)
    const failure = new ApiError({ kind: 'http', code: 'FORBIDDEN', message: 'Safe error', requestId: 'request-demo' })
    assert.match(render({ ...initial, status: 'blocked', error: failure }), /request-demo/)
    assert.match(render({ ...initial, status: 'invalid-query' }), /Tham số URL không hợp lệ/)
    assert.match(render({ ...initial, status: 'reauth', error: failure }), /Đăng nhập lại/)
    assert.match(render(ready, true, false), /Vui lòng đăng nhập/)
  } finally {
    await server.close()
  }
})
