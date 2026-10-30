import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { graph, run } from "./reconstruction-fixtures.mjs";
import { caseDetail } from "./case-fixtures.mjs";
import { EID, scope } from "./event-fixtures.mjs";

test("saved run UI, snapshot log reading and abstentions expose evidence without inventing success", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-audit-ui",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { CaseRunPanel } = await server.ssrLoadModule(
      "/src/features/cases/components/CaseRunPanel.tsx",
    );
    const { EvidenceEvents } = await server.ssrLoadModule(
      "/src/features/cases/components/EvidenceEvents.tsx",
    );
    const { CaseDetailView } = await server.ssrLoadModule(
      "/src/features/cases/components/CaseDetailView.tsx",
    );
    const { initialCasesState } = await server.ssrLoadModule("/src/features/cases/state/state.ts");
    const { degradedLabel } = await server.ssrLoadModule(
      "/src/features/reconstruction/presentation.ts",
    );
    const saved = {
      ...graph(),
      abstentions: [
        { event_id: EID, reason_code: "OUTCOME_UNKNOWN" },
        { event_id: EID, reason_code: "FUTURE_REASON" },
      ],
    };
    const state = {
      ...initialCasesState({ ...scope(), canWrite: false }),
      detail: { status: "ready", id: caseDetail().case.id, data: caseDetail(), error: null },
      caseRun: { status: "ready", run: run("completed"), error: null },
      snapshot: {
        status: "ready",
        runId: saved.run_id,
        graph: saved,
        events: saved.nodes,
        error: null,
      },
    };
    const html = renderToString(
      createElement(CaseRunPanel, { state, active: true, load: async () => {}, actions: {} }),
    );
    assert.match(html, /Phân tích hoàn tất/);
    assert.match(html, /không có nghĩa yêu cầu nghiệp vụ đã thành công/);
    assert.match(html, /Kết quả bước chưa xác định/);
    assert.match(html, /FUTURE_REASON/);
    assert.doesNotMatch(html, /Xác nhận quyết định|Gửi quyết định|Đề xuất liên kết thủ công/);
    const evidence = renderToString(
      createElement(EvidenceEvents, {
        ids: [EID, "outside-snapshot"],
        snapshot: state.snapshot,
        sources: [],
      }),
    );
    assert.match(evidence, /Không tìm thấy sự kiện tham chiếu trong ảnh chụp dữ liệu/);
    assert.match(evidence, /Provenance và log gốc/);
    assert.match(evidence, /Thành công/);
    assert.doesNotMatch(evidence, /<script>/);
    const detail = renderToString(
      createElement(
        MemoryRouter,
        null,
        createElement(CaseDetailView, {
          detail: caseDetail(),
          selectedTab: "reconstruction",
          runPanel: createElement("p", null, "Saved run result"),
        }),
      ),
    );
    assert.match(detail, /aria-selected="true"[^>]*>Kết quả tái dựng/);
    assert.match(detail, /Saved run result/);
    assert.match(degradedLabel("ai_timeout"), /quá thời gian/);
    assert.match(degradedLabel("ai_no_eligible_pairs"), /Không có cặp đủ điều kiện/);
    assert.match(degradedLabel("unknown"), /phương án dự phòng/);
  } finally {
    await server.close();
  }
});
