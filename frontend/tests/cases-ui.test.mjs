import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { caseDetail, caseItem, CID } from "./case-fixtures.mjs";
import { WID, scope } from "./event-fixtures.mjs";

test("case pages render filters, owner null, exact history/evidence DTO, precision and escaped content", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-cases",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { CasesPage } = await server.ssrLoadModule("/src/pages/CasesPage.tsx");
    const { CaseDetailView } = await server.ssrLoadModule(
      "/src/features/cases/components/CaseDetailView.tsx",
    );
    const { CasesContext } = await server.ssrLoadModule(
      "/src/features/cases/state/casesContext.ts",
    );
    const { AuthContext } = await server.ssrLoadModule("/src/features/auth/state/authContext.ts");
    const { WorkspaceContext } = await server.ssrLoadModule(
      "/src/features/workspace/state/workspaceContext.ts",
    );
    const { initialCasesState } = await server.ssrLoadModule("/src/features/cases/state/state.ts");
    const initial = initialCasesState(scope());
    const noop = () => {};
    const render = (state, authenticated = true) =>
      renderToString(
        createElement(
          MemoryRouter,
          null,
          createElement(
            AuthContext.Provider,
            {
              value: {
                state: { status: authenticated ? "authenticated" : "unauthenticated" },
                signIn: async () => {},
              },
            },
            createElement(
              WorkspaceContext.Provider,
              {
                value: {
                  state: {
                    status: "ready",
                    selectedWorkspaceId: WID,
                    sources: { status: "ready", items: [], nextCursor: null },
                  },
                  membership: { workspace_id: WID, roles: ["viewer"] },
                  permissions: { canRead: true, canWrite: false },
                  refreshAccess: async () => {},
                },
              },
              createElement(
                CasesContext.Provider,
                {
                  value: {
                    state,
                    setFilters: noop,
                    refresh: noop,
                    previousPage: noop,
                    nextPage: noop,
                  },
                },
                createElement(CasesPage),
              ),
            ),
          ),
        ),
      ).replace(/<!--.*?-->/g, "");
    const html = render({
      ...initial,
      list: { status: "ready", items: [caseItem()], error: null },
      nextCursor: "next",
    });
    for (const text of [
      "ngày tạo lần tái dựng",
      "Người xử lý",
      "Tìm kiếm",
      "Trước",
      "Tiếp",
      "trạng thái hiện tại",
      "Chưa được gán",
    ])
      assert.ok(html.includes(text));
    assert.match(html, new RegExp(`/cases/${CID}`));
    assert.doesNotMatch(html, /<script>/);
    assert.match(
      render({ ...initial, list: { status: "ready", items: [], error: null } }),
      /Chưa có hồ sơ/,
    );
    assert.match(render(initial, false), /Đăng nhập để xem/);
    assert.match(render({ ...initial, status: "invalid" }), /không hợp lệ/);
    const detail = renderToString(createElement(CaseDetailView, { detail: caseDetail() })).replace(
      /<!--.*?-->/g,
      "",
    );
    for (const text of [
      "Khởi tạo",
      "Evidence refs (ID evidence)",
      "Không có event tham chiếu",
      "Case.version: 1",
      "2026-10-27T07:00:01.123456Z",
      "UTC+7",
    ])
      assert.ok(detail.includes(text));
    assert.match(detail, /&lt;script&gt;note/);
    assert.doesNotMatch(detail, /<script>|<img/);
  } finally {
    await server.close();
  }
});
