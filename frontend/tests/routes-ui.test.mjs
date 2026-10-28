import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve, dirname } from 'node:path'
import { PassThrough } from 'node:stream'
import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

function createRouteServer({ pageGate, failPage = false, onPageLoad = () => {}, name = 'all' } = {}) {
  const clientPath = resolve('src/services/apiClient')
  const knowledgePath = resolve('src/pages/KnowledgePage')
  return createServer({
    configFile: false,
    cacheDir: `node_modules/.tmp/ssr-routes-${name}`,
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: 'route-test-client',
      enforce: 'pre',
      resolveId(source, importer) {
        if (importer && source.startsWith('.') && resolve(dirname(importer), source).replace(/\.ts$/, '') === clientPath) {
          return '\0route-test-client'
        }
        if (importer && source.startsWith('.') && (pageGate || failPage) && resolve(dirname(importer), source).replace(/\.tsx$/, '') === knowledgePath) {
          return '\0route-test-page'
        }
      },
      async load(id) {
        if (id === '\0route-test-client') return `
          function unexpectedRequest() { throw new Error('Route rendering must not request the API') }
          export const apiClient = { get: unexpectedRequest, post: unexpectedRequest }
        `
        if (id === '\0route-test-page') {
          onPageLoad()
          await pageGate
          if (failPage) throw new Error('Simulated private chunk failure')
          return `export function KnowledgePage() { return 'Lazy page finished loading' }`
        }
      },
    }],
  })
}

function renderStream(element, streamShell = false) {
  let resolveLoading
  const loading = new Promise(resolve => { resolveLoading = resolve })
  let stream
  const completed = new Promise((resolve, reject) => {
    let html = ''
    const output = new PassThrough()
    output.setEncoding('utf8')
    output.on('data', chunk => {
      html += chunk
      if (html.includes('Đang tải trang…')) resolveLoading(html)
    })
    output.on('end', () => resolve(html))
    output.on('error', reject)
    stream = renderToPipeableStream(element, {
      onShellReady() { if (streamShell) stream.pipe(output) },
      onAllReady() { if (!streamShell) stream.pipe(output) },
      onShellError: reject,
      onError: reject,
    })
  })
  return { loading, completed, abort: () => stream.abort() }
}

test('all eight routes resolve lazy pages and preserve access guards without requesting the API', { timeout: 10000 }, async () => {
  const server = await createRouteServer()
  try {
    const [
      { AppRoutes }, { AuthContext }, { WorkspaceContext }, { EventsContext }, { CasesContext },
      { initialWorkspaceState }, { initialEventsState }, { initialCasesState },
    ] = await Promise.all([
      server.ssrLoadModule('/src/routes/AppRoutes.tsx'),
      server.ssrLoadModule('/src/features/auth/state/authContext.ts'),
      server.ssrLoadModule('/src/features/workspace/state/workspaceContext.ts'),
      server.ssrLoadModule('/src/features/events/state/eventsContext.ts'),
      server.ssrLoadModule('/src/features/cases/state/casesContext.ts'),
      server.ssrLoadModule('/src/features/workspace/state/state.ts'),
      server.ssrLoadModule('/src/features/events/state/state.ts'),
      server.ssrLoadModule('/src/features/cases/state/state.ts'),
    ])
    const noop = () => {}, asyncNoop = async () => {}
    const auth = { state: { status: 'unauthenticated' }, signIn: asyncNoop, signOut: asyncNoop, getAccessToken: asyncNoop }
    const workspace = {
      state: initialWorkspaceState(), membership: null,
      permissions: { canRead: false, canWrite: false, canVerify: false },
      selectWorkspace: noop, refreshAccess: asyncNoop, loadMoreSources: asyncNoop,
    }
    const events = { state: initialEventsState() }, cases = { state: initialCasesState() }
    const routes = [
      ['/', /TraceWeaver/],
      ['/events', /Vui lòng đăng nhập để xem events/],
      ['/cases', /Đăng nhập để xem cases/],
      ['/cases/88888888-8888-4888-8888-888888888888', /Chi tiết case/],
      ['/knowledge', /Đăng nhập và chọn workspace có quyền đọc để tra cứu knowledge/],
      ['/dashboard', /Đăng nhập và chọn workspace có quyền đọc để xem dashboard/],
      ['/auth/callback', /Đăng nhập chưa hoàn tất hoặc đã bị hủy/],
      ['/missing', /Không tìm thấy trang/],
    ]
    for (const [url, expected] of routes) {
      const element = createElement(MemoryRouter, { initialEntries: [url] },
        createElement(AuthContext.Provider, { value: auth },
          createElement(WorkspaceContext.Provider, { value: workspace },
            createElement(EventsContext.Provider, { value: events },
              createElement(CasesContext.Provider, { value: cases }, createElement(AppRoutes))))))
      const html = await renderStream(element).completed
      assert.match(html, expected, url)
    }
  } finally {
    await server.close()
  }
})

test('slow route module shows loading feedback and then replaces it with the resolved page', { timeout: 10000 }, async () => {
  let release
  const pageGate = new Promise(resolve => { release = resolve })
  const server = await createRouteServer({ pageGate, name: 'slow' })
  let rendering
  try {
    const { AppRoutes } = await server.ssrLoadModule('/src/routes/AppRoutes.tsx')
    rendering = renderStream(createElement('div', null,
      createElement(MemoryRouter, { initialEntries: ['/knowledge'] }, createElement(AppRoutes))), true)
    const shell = await rendering.loading
    assert.match(shell, /role="status"/)
    assert.doesNotMatch(shell, /Lazy page finished loading/)
    release()
    const html = await rendering.completed
    assert.match(html, /Lazy page finished loading/)
    assert.doesNotMatch(html, /Không tải được trang/)
  } finally {
    release()
    rendering?.abort()
    await server.close()
  }
})

test('failed route import renders a safe reload action instead of raw module errors', { timeout: 10000 }, async () => {
  let attempts = 0
  const server = await createRouteServer({ failPage: true, onPageLoad: () => { attempts++ }, name: 'failure' })
  try {
    const { AppRoutes } = await server.ssrLoadModule('/src/routes/AppRoutes.tsx')
    const element = createElement(MemoryRouter, { initialEntries: ['/knowledge'] }, createElement(AppRoutes))
    for (let count = 0; count < 2; count++) {
      const html = await renderStream(element).completed
      assert.match(html, /role="alert"/)
      assert.match(html, /Không tải được trang/)
      assert.match(html, /<button[^>]*type="button"[^>]*>Tải lại trang<\/button>/)
      assert.doesNotMatch(html, /Simulated private chunk failure|stack|Authorization/)
    }
    assert.equal(attempts, 1, 'Rendering the failure again must not retry the module automatically')
  } finally {
    await server.close()
  }
})
