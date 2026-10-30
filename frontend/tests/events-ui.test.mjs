import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createServer } from "vite";
import { resolve, dirname } from "node:path";
import { event, scope, WID, SID } from "./event-fixtures.mjs";

test("events UI renders filters, outcomes, precision, provenance, escaped payload and role-gated root", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-events",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "events-ui-client",
        enforce: "pre",
        resolveId(source, importer) {
          if (
            importer &&
            source.startsWith(".") &&
            resolve(dirname(importer), source).replace(/\.ts$/, "") ===
              resolve("src/services/apiClient")
          )
            return "\0events-ui-client";
        },
        load(id) {
          if (id === "\0events-ui-client")
            return `export const apiClient = { get() { throw new Error('Unexpected request during SSR') }, post() { throw new Error('Unexpected mutation during SSR') } }`;
        },
      },
    ],
  });
  try {
    const { EventDetailView } = await server.ssrLoadModule(
      "/src/features/events/components/EventDetailView.tsx",
    );
    const { EventsExplorer } = await server.ssrLoadModule(
      "/src/features/events/components/EventsExplorer.tsx",
    );
    const { EventsContext } = await server.ssrLoadModule(
      "/src/features/events/state/eventsContext.ts",
    );
    const { WorkspaceContext } = await server.ssrLoadModule(
      "/src/features/workspace/state/workspaceContext.ts",
    );
    const { AuthContext } = await server.ssrLoadModule("/src/features/auth/state/authContext.ts");
    const { initialEventsState } = await server.ssrLoadModule(
      "/src/features/events/state/state.ts",
    );
    const { ApiError } = await server.ssrLoadModule("/src/services/apiError.ts");
    const noop = () => {};
    const actions = {
      setFilters: noop,
      showEvent: noop,
      refresh: noop,
      previousPage: noop,
      nextPage: noop,
      selectRoot: () => true,
      clearRoot: noop,
      retryDetail: noop,
    };
    const membership = { workspace_id: WID, roles: ["operator"], group_ids: [] };
    const initial = initialEventsState(scope());
    const ready = {
      ...initial,
      list: { status: "ready", items: [event()], error: null },
      detail: { status: "ready", event: event(), id: event().event_id, error: null },
      nextCursor: "next",
    };
    function render(
      state,
      canWrite = true,
      authenticated = true,
      detailPage = false,
      id = event().event_id,
    ) {
      const auth = {
        state: { status: authenticated ? "authenticated" : "unauthenticated" },
        signIn: async () => {},
      };
      const workspace = {
        state: {
          status: "ready",
          me: { subject: "a", memberships: [membership] },
          sources: {
            status: "ready",
            items: [{ id: SID, name: "intake" }],
            nextCursor: "next-source",
          },
        },
        membership,
        permissions: { canRead: true, canWrite },
        loadMoreSources: async () => {},
      };
      return renderToString(
        createElement(
          AuthContext.Provider,
          { value: auth },
          createElement(
            WorkspaceContext.Provider,
            { value: workspace },
            createElement(
              EventsContext.Provider,
              { value: { ...actions, state } },
              createElement(
                MemoryRouter,
                { initialEntries: [detailPage ? `/events/${id}?limit=50` : "/events?limit=50"] },
                createElement(
                  Routes,
                  null,
                  createElement(Route, {
                    path: detailPage ? "/events/:eventId" : "/events",
                    element: createElement(detailPage ? EventDetailView : EventsExplorer),
                  }),
                ),
              ),
            ),
          ),
        ),
      ).replace(/<!--.*?-->/g, "");
    }
    const html = render(ready);
    const detailHtml = render(ready, true, true, true);
    assert.doesNotMatch(html, /event-detail-title|has-detail|Chọn làm điểm bắt đầu tái dựng/);
    assert.match(html, new RegExp(`/events/${event().event_id}\\?limit=50`));
    assert.doesNotMatch(detailHtml, /Phân trang sự kiện|id="event-source"|<table/);
    assert.match(detailHtml, /Quay lại danh sách/);
    assert.match(detailHtml, /href="\/events\?limit=50"/);
    assert.match(render(ready, true, true, true, "invalid-id"), /Mã sự kiện không hợp lệ/);
    assert.doesNotMatch(
      render(ready, true, true, true, "22222222-2222-4222-8222-222222222222"),
      /Batch ID|Chọn làm điểm bắt đầu tái dựng/,
    );
    assert.match(
      render(ready, true, true, true, "22222222-2222-4222-8222-222222222222"),
      /Đang tải chi tiết/,
    );

    assert.doesNotMatch(html, /id="event-action"|id="event-q"|name="action"|name="q"/);
    assert.match(html, /id="event-source"/);
    assert.match(html, /id="event-from"/);
    assert.match(html, /id="event-to"/);
    assert.match(html, /id="event-limit"/);
    assert.match(html, /UTC\+7/);
    assert.match(html, /Tìm kiếm/);
    assert.match(html, /Tải thêm nguồn cho bộ lọc/);
    assert.match(html, /Phân trang sự kiện/);
    assert.match(html, /Trước/);
    assert.match(html, /Tiếp/);
    assert.match(html, /success/);
    assert.match(html, /2026-10-26T06:00:00.000001Z/);
    assert.match(detailHtml, /Batch ID/);
    assert.match(detailHtml, /events\[1\]/);
    assert.match(detailHtml, /a{64}/);
    assert.match(detailHtml, /Chọn làm điểm bắt đầu tái dựng/);
    assert.match(detailHtml, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>|<img src=x/);
    assert.doesNotMatch(render(ready, false, true, true), /Chọn làm điểm bắt đầu tái dựng/);
    assert.match(
      render({ ...ready, root: event() }),
      /Điểm bắt đầu tái dựng: example · Đã tiếp nhận yêu cầu/,
    );
    assert.match(
      render({ ...initial, list: { status: "ready", items: [], error: null } }),
      /Chưa có sự kiện/,
    );
    assert.match(
      render({ ...initial, list: { status: "loading", items: [], error: null } }),
      /Đang tải sự kiện/,
    );
    assert.doesNotMatch(html, /Xóa bộ lọc|Điều kiện đang áp dụng|Đang áp dụng:/);
    assert.doesNotMatch(html, /Xem cùng mã yêu cầu/);
    assert.match(
      render({
        ...initial,
        filters: { limit: 50, q: "absent" },
        list: { status: "ready", items: [], error: null },
      }),
      /Không có kết quả phù hợp bộ lọc/,
    );
    const table = html.match(/<table[\s\S]*?<\/table>/)[0];
    assert.match(table, /Mã yêu cầu/);
    assert.equal((table.match(/<th\b/g) ?? []).length, 6);
    assert.doesNotMatch(table, /<th[^>]*>Chi tiết<\/th>|>Xem<|Xem cùng mã yêu cầu/);
    assert.match(
      table,
      new RegExp(`<a[^>]*href="/events/${event().event_id}\\?limit=50"[^>]*>example</a>`),
    );
    assert.match(table, /example/);
    assert.match(table, /Tiếp nhận yêu cầu/);
    assert.match(table, /Đã tiếp nhận yêu cầu/);
    assert.match(table, /Thành công/);
    assert.match(table, /13:00:00 · 26\/10\/2026/);
    assert.doesNotMatch(table, new RegExp(SID));
    assert.doesNotMatch(table, /<span[^>]*>2026-10-26T/);
    assert.match(detailHtml, /data-slot="accordion-trigger"[^>]*>Chi tiết kỹ thuật/);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
    const failed = {
      ...event(),
      action: "provision.failed",
      outcome: "failed",
      payload_redacted: { error_code: "CAPACITY_EXHAUSTED" },
    };
    const missing = {
      ...event("22222222-2222-4222-8222-222222222222"),
      identifiers: [],
      source_id: "unloaded-source",
      action: "new.action",
      outcome: "unknown",
      message: "",
    };
    const mixed = render({
      ...initial,
      list: { status: "ready", items: [failed, missing], error: null },
    });
    assert.match(mixed, /Cấp môi trường thất bại/);
    assert.match(mixed, /Thất bại/);
    assert.match(mixed, /Không đủ tài nguyên để cấp môi trường/);
    assert.match(mixed, /Nguồn không khả dụng/);
    assert.match(mixed, /Hoạt động: new.action/);
    assert.match(mixed, /Log không có thông điệp/);
    assert.match(mixed, /Chưa xác định/);
    assert.doesNotMatch(mixed, /Đang xử lý/);
    const failure = new ApiError({
      kind: "http",
      code: "FORBIDDEN",
      message: "Safe error",
      requestId: "request-demo",
    });
    assert.match(render({ ...initial, status: "blocked", error: failure }), /request-demo/);
    assert.match(render({ ...initial, status: "invalid-query" }), /Tham số URL không hợp lệ/);
    assert.match(render({ ...initial, status: "reauth", error: failure }), /Đăng nhập lại/);
    assert.match(render(ready, true, false), /Vui lòng đăng nhập/);
  } finally {
    await server.close();
  }
});
