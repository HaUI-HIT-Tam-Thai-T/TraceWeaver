import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createServer } from "vite";
import { page, scope, completed, WID } from "./admin-fixtures.mjs";
import { ApiError } from "../src/services/apiError.ts";

test("admin UI uses server roles, guards direct route access and shows read-only reviewer/sidebar correctly", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-admin-ui",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const [
      { WorkspaceAdminAccess },
      { AppSidebar },
      { WorkspaceContext },
      { AuthContext },
      { workspacePermissions },
      { WorkspaceAdminView },
      { initialAdminState },
    ] = await Promise.all([
      server.ssrLoadModule("/src/routes/WorkspaceAdminAccess.tsx"),
      server.ssrLoadModule("/src/components/layout/AppSidebar.tsx"),
      server.ssrLoadModule("/src/features/workspace/state/workspaceContext.ts"),
      server.ssrLoadModule("/src/features/auth/state/authContext.ts"),
      server.ssrLoadModule("/src/features/workspace/state/state.ts"),
      server.ssrLoadModule("/src/features/workspace-admin/components/WorkspaceAdminView.tsx"),
      server.ssrLoadModule("/src/features/workspace-admin/controller.ts"),
    ]);
    for (const roles of [
      ["viewer"],
      ["operator"],
      ["reviewer"],
      ["admin"],
      ["admin", "reviewer"],
    ]) {
      const membership = { workspace_id: WID, roles, group_ids: [] },
        permissions = workspacePermissions(membership);
      const html = renderToStaticMarkup(
        h(
          MemoryRouter,
          { initialEntries: ["/workspace-admin?tab=accounts"] },
          h(
            AuthContext.Provider,
            { value: { state: { status: "authenticated" }, signOut: async () => {} } },
            h(
              WorkspaceContext.Provider,
              { value: { membership, permissions } },
              h(AppSidebar),
              h(
                Routes,
                null,
                h(
                  Route,
                  { element: h(WorkspaceAdminAccess) },
                  h(Route, { path: "/workspace-admin", element: h("p", null, "Admin payload") }),
                ),
              ),
            ),
          ),
        ),
      );
      if (roles.includes("admin")) {
        assert.match(html, /Admin payload/);
        assert.match(html, /href="\/workspace-admin"/);
      } else {
        assert.doesNotMatch(html, /Admin payload|href="\/workspace-admin"/);
        assert.match(html, /Không có quyền quản trị/);
      }
      if (roles.length === 1 && roles[0] === "admin") assert.equal(permissions.canVerify, false);
    }
    const state = {
      ...initialAdminState(scope()),
      list: {
        status: "ready",
        items: [{ ...page().items[0], subject: "<script>unsafe</script>" }],
        version: 1,
        next: null,
        error: null,
      },
    };
    const controller = {
      refresh: async () => {},
      more: async () => {},
      mutate: async () => {},
      createAccount: async () => {},
      checkOperation: async () => {},
      resetAccount: () => {},
    };
    const render = (data = state, tab = "members") =>
      renderToStaticMarkup(
        h(WorkspaceAdminView, {
          state: data,
          controller,
          sources: [],
          sourcesReady: true,
          tab,
          changeTab() {},
        }),
      );
    const html = render();
    assert.match(html, /aria-label="Thành viên workspace"/);
    assert.match(html, /Sao chép subject/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /<caption|Đang áp dụng|display_name|clientSecret/);
    assert.match(html, /Thêm thành viên/);
    assert.match(html, /type="password"/);
    assert.doesNotMatch(html, /<form[^>]*aria-label="Sửa thành viên"/);
    assert.match(html, /giữ trong bộ nhớ/);
    const pending = render(
      {
        ...state,
        account: {
          ...state.account,
          key: "fixture-key",
          username: "fixture.new-user",
          roles: ["viewer"],
          status: "pending",
        },
      },
      "accounts",
    );
    assert.match(pending, /Kiểm tra trạng thái/);
    assert.match(pending, /Thử hoàn tất lại cùng mã thao tác/);
    assert.doesNotMatch(pending, /Đã tạo tài khoản/);
    const pendingMembers = render(
      { ...state, account: { ...state.account, key: "fixture-key", status: "pending" } },
      "members",
    );
    const addButton = pendingMembers.match(/<button[^>]*>Thêm thành viên<\/button>/)?.[0];
    assert.ok(addButton);
    assert.doesNotMatch(addButton, /\sdisabled(?:=|\s|>)/);
    for (const code of ["ACCOUNT_POLICY_REJECTED", "ACCOUNT_OWNERSHIP_CONFLICT"]) {
      const rejection = new ApiError({
        kind: "http",
        status: 422,
        code,
        message: "Safe rejection",
      });
      const rejected = render(
        {
          ...state,
          account: {
            ...state.account,
            key: "fixture-key",
            status: "pending",
            rejection,
            error: null,
          },
        },
        "accounts",
      );
      assert.match(rejected, /Kiểm tra trạng thái/);
      assert.match(rejected, /Đã dừng gửi lại nội dung bị từ chối/);
      assert.doesNotMatch(rejected, /Thử hoàn tất lại cùng mã thao tác|Đã tạo tài khoản/);
      assert.match(rejected, /tải lại trang không hủy thao tác cũ/);
    }
    const readError = render(
      { ...state, list: { ...state.list, status: "error", version: null } },
      "accounts",
    );
    assert.match(readError, /type="password"/); // GET failures must not unmount and erase the current intent's password.
    const done = render(
      { ...state, account: { ...state.account, status: "completed", result: completed() } },
      "accounts",
    );
    assert.match(done, /Đã tạo tài khoản/);
    assert.match(done, /chưa tự có quyền nguồn/);
    assert.match(done, /Tới Thành viên và quyền để cấp nguồn/);
    assert.ok(done.includes(`Sao chép subject ${completed().subject}`));
  } finally {
    await server.close();
  }
});
