import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { event, EID, EID2, WID } from "./event-fixtures.mjs";
import { graph } from "./reconstruction-fixtures.mjs";
import { runFormDefaults, toRunBody } from "../src/features/reconstruction/form.ts";

test("UX presentation preserves actual messages, precise time ordering, safe sources and disclosed uncertainty", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-ux-presentation",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const present = await server.ssrLoadModule("/src/features/events/presentation.ts");
    const { orderedSteps, graphStepLabel, scoreExplanation } = await server.ssrLoadModule(
      "/src/features/reconstruction/presentation.ts",
    );
    assert.equal(
      present.eventDescription({ ...event(), message: "  Original log\nnot an action label  " }),
      "  Original log\nnot an action label  ",
    );
    assert.deepEqual(
      present.requestIds({
        ...event(),
        identifiers: [
          { namespace: "request", value: "r" },
          { namespace: "request", value: "r" },
          { namespace: "account", value: "a" },
        ],
      }),
      ["r"],
    );
    assert.equal(present.sourceName("unrecognized-source"), "unrecognized-source");
    assert.equal(present.sourceName("provision"), "Cấp môi trường");
    const sample = graph();
    sample.nodes = [
      { ...event(EID2), occurred_at: "2026-10-26T06:00:00.000002Z" },
      { ...event(EID), occurred_at: "2026-10-26T06:00:00.000001Z" },
    ];
    const before = structuredClone(sample);
    assert.deepEqual(
      orderedSteps(sample).map((item) => item.event_id),
      [EID, EID2],
    );
    assert.deepEqual(sample, before);
    assert.match(graphStepLabel(sample, EID2), /Bước 2: Đã tiếp nhận yêu cầu/);
    assert.doesNotMatch(graphStepLabel(sample, EID2), new RegExp(EID2));
    assert.match(
      scoreExplanation({ ...sample.links[0], method: "model", score: 0.8 }),
      /không phải xác suất/,
    );
    assert.match(scoreExplanation(sample.links[0]), /Không có điểm/);
    const { GraphTable } = await server.ssrLoadModule(
      "/src/features/reconstruction/components/GraphTable.tsx",
    );
    const html = renderToString(createElement(GraphTable, { graph: sample }));
    assert.match(html, /<ol/);
    assert.doesNotMatch(html, /<table/);
    assert.match(html, /không chứng minh quan hệ nguyên nhân/);
    assert.match(html, /không có nghĩa bước đó chắc chắn chưa diễn ra/);
    assert.match(html, /chưa có bằng chứng/);
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /<details[^>]* open/);
    const { PreciseDateTimeField } = await server.ssrLoadModule(
      "/src/components/ui/PreciseDateTimeField.tsx",
    );
    const defaults = runFormDefaults(event());
    const date = renderToString(
      createElement(PreciseDateTimeField, {
        id: "time",
        label: "Từ",
        value: defaults.from,
        onChange() {},
      }),
    );
    assert.match(date, /type="datetime-local"/);
    assert.match(date, /value="2026-10-26T12:55:00"/);
    assert.match(date, /value="000001"/);
    const body = toRunBody(defaults, event());
    assert.equal(body.window.from, "2026-10-26T05:55:00.000001Z");
    assert.equal(body.window.to, "2026-10-26T06:05:00.000001Z");
    const { KnowledgeResults } = await server.ssrLoadModule(
      "/src/features/knowledge/components/KnowledgeView.tsx",
    );
    const { initialKnowledgeState } = await server.ssrLoadModule(
      "/src/features/knowledge/state/controller.ts",
    );
    function article(source_ref) {
      return renderToString(
        createElement(KnowledgeResults, {
          state: {
            ...initialKnowledgeState(),
            status: "ready",
            items: [
              {
                id: EID,
                workspace_id: WID,
                title: "Guide",
                body: "<img src=x onerror=bad()>",
                source_ref,
                version: 1,
                author_subject: "a",
                created_at: event().occurred_at,
              },
            ],
          },
          refresh() {},
          previous() {},
          next() {},
          signIn() {},
        }),
      );
    }
    assert.match(article("https://example.com/guide"), /href="https:\/\/example.com\/guide"/);
    for (const unsafe of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "urn:guide:one",
      "https://name:password@example.com/guide",
    ])
      assert.doesNotMatch(article(unsafe), /<a[ >]/);
    assert.match(article("https://example.com"), /&lt;img/);
    assert.doesNotMatch(article("https://example.com"), /<img/);
    const { CaseTime } = await server.ssrLoadModule(
      "/src/features/cases/components/CaseDetailView.tsx",
    );
    const time = renderToString(createElement(CaseTime, { value: event().occurred_at }));
    assert.match(time, /dateTime="2026-10-26T06:00:00.000001Z"/);
    assert.doesNotMatch(time, /<details|<summary/); // Safe inside the paragraphs and table cells that use CaseTime.
    const { FilterSummary } = await server.ssrLoadModule("/src/components/ui/FilterSummary.tsx");
    const summary = renderToString(
      createElement(FilterSummary, { items: ["Từ khóa: <script>"], onClear() {} }),
    );
    assert.match(summary, /Xóa bộ lọc/);
    assert.match(summary, /type="button"/);
    assert.match(summary, /&lt;script&gt;/);
  } finally {
    await server.close();
  }
});
