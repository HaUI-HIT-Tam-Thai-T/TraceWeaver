import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { run, graph } from "./reconstruction-fixtures.mjs";

test("run UI safely renders degraded, failed, uncertain, tracking, errors and graph evidence", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-reconstruction",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { RunResult } = await server.ssrLoadModule(
      "/src/features/reconstruction/components/RunResult.tsx",
    );
    const { initialReconstructionState } = await server.ssrLoadModule(
      "/src/features/reconstruction/state/state.ts",
    );
    const render = (patch) =>
      renderToString(
        createElement(RunResult, {
          state: { ...initialReconstructionState(), ...patch },
          retry() {},
          track() {},
          loadGraph() {},
          signIn() {},
        }),
      ).replace(/<!--.*?-->/g, "");
    const html = render({
      phase: "known",
      run: run("completed", { degraded: true, degraded_reason: "ai_unavailable" }),
      graph: graph(),
      graphStatus: "ready",
    });
    assert.match(html, /AI chưa sẵn sàng, kết quả dùng luật/);
    assert.match(html, /Không có điểm đánh giá/);
    assert.match(html, /pending/);
    assert.match(html, /chưa có bằng chứng/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(render({ phase: "uncertain" }), /Gửi lại thao tác/);
    assert.match(
      render({ phase: "known", run: run("running"), tracking: "paused" }),
      /Kiểm tra tiếp/,
    );
    assert.match(render({ graphStatus: "error" }), /Tải lại kết quả liên kết/);
    assert.match(render({ phase: "reauth" }), /Đăng nhập lại/);
    assert.match(
      render({
        run: run("failed", { error: { code: "FAIL", message: "<script>secret</script>" } }),
      }),
      /FAIL/,
    );
    assert.doesNotMatch(
      render({ run: run("failed", { error: { code: "FAIL", message: "secret raw backend" } }) }),
      /secret raw backend/,
    );
    assert.match(
      render({ error: { code: "WINDOW_TOO_LARGE", message: "safe", requestId: "req-1" } }),
      /Thu hẹp/,
    );
    assert.match(
      render({ error: { code: "NETWORK", message: "safe", requestId: "req-1" } }),
      /req-1/,
    );
  } finally {
    await server.close();
  }
});
