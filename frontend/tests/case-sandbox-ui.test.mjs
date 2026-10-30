import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { sandbox, proof, proofs, attempt } from "./sandbox-fixtures.mjs";
import { CID, caseDetail } from "./case-fixtures.mjs";
import { scope, WID } from "./event-fixtures.mjs";
import { ApiError } from "../src/services/apiError.ts";

test("sandbox is visible outside canWrite, roles gate actions, historical failures do not override current result and data is escaped", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-sandbox-ui",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const [
      { SandboxPanel, AttemptView },
      { initialCasesState },
      { CaseDetailPage },
      { CasesContext },
      { AuthContext },
      { WorkspaceContext },
    ] = await Promise.all([
      server.ssrLoadModule("/src/features/case-sandbox/SandboxPanel.tsx"),
      server.ssrLoadModule("/src/features/cases/state/state.ts"),
      server.ssrLoadModule("/src/pages/CaseDetailPage.tsx"),
      server.ssrLoadModule("/src/features/cases/state/casesContext.ts"),
      server.ssrLoadModule("/src/features/auth/state/authContext.ts"),
      server.ssrLoadModule("/src/features/workspace/state/workspaceContext.ts"),
    ]);
    const noop = async () => {};
    const actions = {
      loadSandbox: noop,
      submitSandboxCommand: noop,
      retrySandboxProvision: noop,
      saveSandboxProof: noop,
      beginSandboxIntent() {},
    };
    function stateFor(role, closed = false) {
      const state = initialCasesState({
        ...scope(),
        canAdmin: role === "admin",
        canWrite: ["operator", "reviewer"].includes(role),
        canVerify: role === "reviewer",
      });
      const detail = caseDetail();
      detail.case.state = closed ? "closed" : "awaiting_verification";
      state.detail = { status: "ready", id: CID, data: detail, error: null };
      const observed = sandbox();
      observed.observation.request_id = "<script>escape</script>";
      observed.observation.result = "passed";
      state.sandbox.snapshot = { status: "ready", data: observed, error: null };
      state.sandbox.lab = { status: "ready", data: { version: 4, ram: 32 }, error: null };
      state.sandbox.proofs = { status: "ready", data: proofs([proof()]), error: null };
      return state;
    }
    for (const role of ["viewer", "admin", "operator", "reviewer"]) {
      const state = stateFor(role);
      const html = renderToStaticMarkup(h(SandboxPanel, { state, actions }));
      assert.match(html, /Kiểm chứng nghiệp vụ mô phỏng/);
      assert.match(html, /32 GB/);
      assert.match(html, /Đã chạy đạt — chờ chuyển log/);
      assert.match(html, /&lt;script&gt;escape/);
      assert.doesNotMatch(html, /<script>/);
      assert.equal(html.includes('aria-label="Sửa điều kiện mô phỏng"'), role === "admin");
      assert.equal(html.includes(">Chạy lại mô phỏng<"), ["operator", "reviewer"].includes(role));
      assert.equal(html.includes(">Lưu kiểm chứng nguồn<"), role === "reviewer");
      assert.match(html, /Chưa đủ kết luận/);
      assert.doesNotMatch(html, /RAM_AVAILABLE<\/li>/);
      const page = renderToStaticMarkup(
        h(
          MemoryRouter,
          { initialEntries: [`/cases/${CID}`] },
          h(
            AuthContext.Provider,
            { value: { state: { status: "authenticated" } } },
            h(
              WorkspaceContext.Provider,
              {
                value: {
                  state: { status: "ready", selectedWorkspaceId: WID, sources: { items: [] } },
                  permissions: { canRead: true, canWrite: state.scope.canWrite },
                },
              },
              h(
                CasesContext.Provider,
                { value: { state, ...actions } },
                h(Routes, null, h(Route, { path: "/cases/:caseId", element: h(CaseDetailPage) })),
              ),
            ),
          ),
        ),
      );
      assert.match(page, /aria-label="Kiểm chứng nghiệp vụ mô phỏng"/);
      assert.ok(
        page.indexOf('class="case-overview') <
          page.indexOf('aria-label="Kiểm chứng nghiệp vụ mô phỏng"'),
      );
    }
    const closed = renderToStaticMarkup(
      h(SandboxPanel, { state: stateFor("reviewer", true), actions }),
    );
    for (const label of ["Chạy lại mô phỏng", "Lưu kiểm chứng nguồn"])
      assert.match(
        closed.match(new RegExp(`<button[^>]*>${label}<\\/button>`))?.[0] ?? "",
        / disabled=""/,
      );
    const staleClosed = stateFor("reviewer", true);
    staleClosed.detail.data.case.version = 2;
    staleClosed.sandbox.snapshot.data.case_version = 2;
    staleClosed.sandbox.snapshot.data.observation.result = "inconclusive";
    staleClosed.sandbox.snapshot.data.observation.reason = "RERUN_REQUIRED";
    const closedHtml = renderToStaticMarkup(h(SandboxPanel, { state: staleClosed, actions }));
    assert.match(closedHtml, /Hồ sơ đã đóng — xem kết quả/);
    assert.match(closedHtml, /Đây không phải kết quả chạy thất bại/);
    assert.match(closedHtml, /Bản kiểm chứng lịch sử tại thời điểm lưu/);
    assert.doesNotMatch(
      closedHtml,
      /Nguồn đang ghi nhận: Chưa đủ kết luận|Khác phiên bản hồ sơ hiện tại; cần kiểm chứng mới/,
    );
    const verified = stateFor("reviewer");
    const current = verified.sandbox.snapshot.data.observation;
    current.source_version = 5;
    current.reason = null;
    current.delivery = { status: "delivered", total: 1, delivered: 1 };
    current.attempt = attempt({
      result: "passed",
      reason: null,
      blockers: [],
      image_available: true,
      checks: attempt().checks.map((check) => ({ ...check, passed: true })),
    });
    current.attempts = [current.attempt];
    current.environment = {
      id: "environment-one",
      attempt_id: current.attempt.id,
      state: "running",
    };
    const saved = proof({ observation: { ...structuredClone(current), source_version: 4 } });
    verified.sandbox.proofs.data = proofs([saved]);
    const verifiedHtml = renderToStaticMarkup(h(SandboxPanel, { state: verified, actions }));
    assert.match(verifiedHtml, /Đã lưu kiểm chứng đạt — chờ reviewer đóng hồ sơ/);
    assert.match(verifiedHtml, /Bản kiểm chứng khớp lần chạy hiện tại/);
    assert.doesNotMatch(
      verifiedHtml,
      /chờ reviewer xác minh|Chuyển hồ sơ sang chờ xác minh|Phiên bản hoặc định danh nguồn đã thay đổi/,
    );
    for (const status of ["loading", "error"]) {
      verified.sandbox.proofs.status = status;
      const unread = renderToStaticMarkup(h(SandboxPanel, { state: verified, actions }));
      assert.match(unread, /Đã chạy đạt — cần đọc kiểm chứng/);
      assert.doesNotMatch(unread, /Đã lưu kiểm chứng đạt — chờ reviewer đóng hồ sơ/);
    }
    verified.sandbox.proofs.status = "ready";
    verified.sandbox.proofs.data.items.push(
      proof({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", observation: { result: "failed" } }),
    );
    const newerFailure = renderToStaticMarkup(h(SandboxPanel, { state: verified, actions }));
    assert.match(newerFailure, /Đã chạy đạt — chờ reviewer xác minh/);
    assert.doesNotMatch(newerFailure, /Đã lưu kiểm chứng đạt — chờ reviewer đóng hồ sơ/);
    const legacy = renderToStaticMarkup(
      h(AttemptView, { attempt: { checker_version: "lab-state-1", result: "passed" } }),
    );
    assert.match(legacy, /không dùng để kết luận nguồn hiện tại đạt/);
    const modern = renderToStaticMarkup(h(AttemptView, { attempt: attempt() }));
    assert.match(modern, /Image: Không đạt/);
    assert.match(modern, /RAM: Đạt/);
    const regular = stateFor("reviewer");
    regular.sandbox.snapshot = {
      status: "error",
      data: null,
      error: new ApiError({
        kind: "http",
        status: 422,
        code: "SANDBOX_BINDING_REQUIRED",
        message: "Unbound case",
      }),
    };
    regular.sandbox.lab = {
      status: "error",
      data: null,
      error: new ApiError({
        kind: "http",
        status: 404,
        code: "NOT_FOUND",
        message: "No lab configured",
      }),
    };
    regular.sandbox.proofs = { status: "ready", data: proofs(), error: null };
    const regularHtml = renderToStaticMarkup(h(SandboxPanel, { state: regular, actions }));
    assert.match(regularHtml, /Hồ sơ này chưa gắn với nguồn mô phỏng/);
    assert.doesNotMatch(
      regularHtml,
      /role="alert"|SANDBOX_BINDING_REQUIRED|NOT_FOUND|Chưa có lịch sử thực thi|Chạy lại mô phỏng|Lưu kiểm chứng nguồn/,
    );
    regular.sandbox.lab.error = new ApiError({
      kind: "http",
      status: 503,
      code: "CORE_NOT_READY",
      message: "Source temporarily unavailable",
    });
    const outageHtml = renderToStaticMarkup(h(SandboxPanel, { state: regular, actions }));
    assert.match(outageHtml, /role="alert"/);
    assert.doesNotMatch(outageHtml, /Hồ sơ này chưa gắn với nguồn mô phỏng/);
  } finally {
    await server.close();
  }
});
