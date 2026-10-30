import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { graph } from "./reconstruction-fixtures.mjs";

test("link editor has labeled review/manual forms, readonly guard, locks and safe feedback", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-link-review",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { LinkReviewPanel } = await server.ssrLoadModule(
      "/src/features/link-review/components/LinkReviewPanel.tsx",
    );
    const actions = {
      reviewLink: async () => {},
      createManualLink: async () => {},
      probeClosedCase() {},
    };
    const render = (patch = {}) =>
      renderToString(
        createElement(LinkReviewPanel, {
          graph: graph(),
          graphReady: true,
          mutation: { status: "idle", error: null, linkId: null },
          caseLocked: false,
          canWrite: true,
          actions,
          ...patch,
        }),
      ).replace(/<!--.*?-->/g, "");
    const html = render();
    for (const text of [
      "Liên kết cần duyệt",
      "Quyết định",
      "Lý do quyết định",
      "Bước nguồn",
      "Bước đích",
      "Lý do đề xuất",
      "chờ duyệt",
    ])
      assert.ok(html.includes(text));
    assert.match(html, /Chấp nhận liên kết/);
    assert.match(html, /Từ chối liên kết/);
    assert.match(html, /Bước 1: Đã tiếp nhận yêu cầu/);
    assert.doesNotMatch(html, /<option[^>]*>11111111/);
    assert.equal(render({ canWrite: false }), "");
    assert.match(render({ graphReady: false }), /fieldset disabled/);
    assert.match(render({ caseLocked: true }), /Thử chỉnh sửa lại/);
    for (const [status, text] of [
      ["uncertain", "không tự gửi lại thao tác"],
      ["success", "Đã ghi thao tác"],
      ["conflict", "Liên kết đã được người khác cập nhật"],
      ["duplicate", "Liên kết cùng hướng"],
    ])
      assert.ok(render({ mutation: { status, error: null, linkId: null } }).includes(text));
    const error = { code: "LINK_CYCLE", message: "safe", requestId: "request-demo" };
    assert.match(render({ mutation: { status: "error", error, linkId: null } }), /chu trình/);
    assert.match(
      render({
        mutation: {
          status: "error",
          error: { code: "ERR", message: "<script>unsafe</script>", requestId: null },
          linkId: null,
        },
      }),
      /&lt;script&gt;/,
    );
  } finally {
    await server.close();
  }
});
