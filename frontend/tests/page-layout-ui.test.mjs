import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { caseDetail } from "./case-fixtures.mjs";

test("page layout primitives preserve accessible headings, tabs/disclosures, skeleton variants and escaped data", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-page-layout",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const [
      { PageHeading },
      { TechnicalDetails },
      { CaseDetailView },
      { LoadingState },
      { SectionReveal },
      { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage },
      { Separator },
    ] = await Promise.all([
      server.ssrLoadModule("/src/components/layout/PageHeading.tsx"),
      server.ssrLoadModule("/src/components/ui/TechnicalDetails.tsx"),
      server.ssrLoadModule("/src/features/cases/components/CaseDetailView.tsx"),
      server.ssrLoadModule("/src/components/ui/LoadingState.tsx"),
      server.ssrLoadModule("/src/components/ui/SectionReveal.tsx"),
      server.ssrLoadModule("/src/components/ui/primitives/breadcrumb.tsx"),
      server.ssrLoadModule("/src/components/ui/primitives/separator.tsx"),
    ]);
    const heading = renderToString(
      h(PageHeading, {
        title: "Hồ sơ <img>",
        description: "Mô tả",
        actions: h("button", { type: "button" }, "Làm mới"),
      }),
    );
    assert.equal((heading.match(/<h1/g) ?? []).length, 1);
    assert.match(heading, /&lt;img&gt;/);
    assert.match(heading, /Làm mới/);
    assert.match(heading, /data-slot="separator"/);
    const technical = renderToString(
      h(TechnicalDetails, { title: "Thông tin kỹ thuật" }, h("p", null, "<script>")),
    );
    assert.match(technical, /data-slot="accordion-trigger"/);
    assert.match(technical, /aria-expanded="false"/);
    assert.match(technical, /role="region" aria-labelledby=/);
    assert.match(
      technical,
      /data-slot="accordion-content"[^>]*data-state="closed"|data-state="closed"[^>]*data-slot="accordion-content"/,
    );
    assert.match(technical, /&lt;script&gt;/);
    const detail = renderToString(h(CaseDetailView, { detail: caseDetail() })).replace(
      /<!--.*?-->/g,
      "",
    );
    assert.match(detail, /role="tablist"/);
    assert.equal((detail.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((detail.match(/role="tabpanel"/g) ?? []).length, 2);
    assert.match(detail, /value="history"|content-history/);
    assert.match(detail, /aria-selected="true"/);
    assert.match(detail, /data-state="inactive"/);
    assert.match(detail, /Mở bằng chứng 1/);
    assert.match(detail, /id="evidence-99999999-9999-4999-8999-999999999999"/);
    assert.doesNotMatch(detail, /<script>|<img/);
    for (const variant of ["table", "counters"]) {
      const loading = renderToString(h(LoadingState, { variant, message: "Đang tải" }));
      assert.equal((loading.match(/data-slot="skeleton"/g) ?? []).length, 4);
      assert.match(loading, /role="status"/);
      assert.match(loading, /aria-hidden="true"/);
      assert.match(loading, /motion-reduce:animate-none/);
    }
    const breadcrumb = renderToString(
      h(
        Breadcrumb,
        { "aria-label": "Vị trí" },
        h(BreadcrumbList, null, h(BreadcrumbItem, null, h(BreadcrumbPage, null, "Chi tiết"))),
      ),
    );
    assert.match(breadcrumb, /<nav/);
    assert.match(breadcrumb, /aria-current="page"/);
    assert.match(renderToString(h(Separator, { decorative: false })), /role="separator"/);
    const reveal = renderToString(h(SectionReveal, null, "Nội dung"));
    assert.match(reveal, /Nội dung/);
    assert.match(reveal, /translateY\(6px\)/);
  } finally {
    await server.close();
  }
});
