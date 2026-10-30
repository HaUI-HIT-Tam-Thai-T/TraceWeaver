import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { getPageTitle } from "../src/constants/pageTitles.ts";
import { graph } from "./reconstruction-fixtures.mjs";
import { event } from "./event-fixtures.mjs";

test("page titles describe only known routes and never disclose case identity or query data", () => {
  for (const [path, name] of [
    ["/", "Tổng quan"],
    ["/dashboard/", "Tổng quan"],
    ["/events", "Sự kiện"],
    ["/events/private-id", "Chi tiết sự kiện"],
    ["/cases", "Hồ sơ"],
    ["/cases/private-case-id", "Chi tiết hồ sơ"],
    ["/knowledge", "Tri thức"],
    ["/auth/callback", "Đăng nhập"],
    ["/unknown", "Không tìm thấy trang"],
    ["/constructor", "Không tìm thấy trang"],
  ])
    assert.equal(getPageTitle(path), `${name} | TraceWeaver`);
  assert.doesNotMatch(getPageTitle("/cases/private-case-id"), /private-case-id/);
  assert.doesNotMatch(getPageTitle("/unknown?q=secret"), /secret/);
  assert.equal(getPageTitle("/cases/private/nested"), "Không tìm thấy trang | TraceWeaver");
});

test("technical heading levels follow their context and retain accessible accordion controls", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-design-principles",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { TechnicalDetails } = await server.ssrLoadModule(
      "/src/components/ui/TechnicalDetails.tsx",
    );
    for (const level of [3, 4, 5, 6]) {
      const html = renderToString(
        h(TechnicalDetails, { title: "Kỹ thuật", headingLevel: level }, "<script>"),
      );
      assert.match(html, new RegExp(`<h${level}[^>]*><button`));
      assert.match(html, /aria-expanded="false"/);
      assert.match(html, /&lt;script&gt;/);
      assert.doesNotMatch(html, /headingLevel=/);
    }
    const { EventTechnicalDetails } = await server.ssrLoadModule(
      "/src/features/events/components/EventPresentation.tsx",
    );
    const detail = renderToString(h(EventTechnicalDetails, { event: event(), headingLevel: 4 }));
    assert.match(detail, /<h4[^>]*><button/);
    assert.match(detail, /<h5[^>]*>Mã định danh/);
    assert.doesNotMatch(detail, /<h3/);
    const { GraphTable } = await server.ssrLoadModule(
      "/src/features/reconstruction/components/GraphTable.tsx",
    );
    const result = renderToString(h(GraphTable, { graph: graph() }));
    assert.equal((result.match(/<h3/g) ?? []).length, 1);
    assert.match(result, /<h5[^>]*><button/);
  } finally {
    await server.close();
  }
});

test("static description is generic and does not change indexing policy", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.match(html, /<html lang="vi">/);
  assert.doesNotMatch(html, /name="robots"|application\/ld\+json/);
});
