// All actions stay in memory. This fixture never calls authentication or backend services.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../src/features/auth/state/authContext";
import { WorkspaceContext } from "../../src/features/workspace/state/workspaceContext";
import { initialWorkspaceState } from "../../src/features/workspace/state/state";
import { EventsContext } from "../../src/features/events/state/eventsContext";
import { initialEventsState } from "../../src/features/events/state/state";
import { EventsExplorer } from "../../src/features/events/components/EventsExplorer";
import { SourceScopePicker } from "../../src/features/reconstruction/components/SourceScopePicker";
import { PreciseDateTimeField } from "../../src/components/ui/PreciseDateTimeField";
import { Button } from "../../src/components/ui/Button";
import { RunResult } from "../../src/features/reconstruction/components/RunResult";
import { initialReconstructionState } from "../../src/features/reconstruction/state/state";
import { CaseDetailView } from "../../src/features/cases/components/CaseDetailView";
import { KnowledgeResults } from "../../src/features/knowledge/components/KnowledgeView";
import { initialKnowledgeState } from "../../src/features/knowledge/state/controller";
import { runFormDefaults, runFormSchema, toRunBody } from "../../src/features/reconstruction/form";
import { event, scope, WID, SID } from "../event-fixtures.mjs";
import { graph, run } from "../reconstruction-fixtures.mjs";
import { caseDetail } from "../case-fixtures.mjs";
import "../../src/index.css";

const sample = graph();
sample.nodes[0] = { ...sample.nodes[0], message: "Đã nhận yêu cầu REQ-2026-01 từ cổng tiếp nhận." };
sample.nodes[1] = {
  ...sample.nodes[1],
  action: "account.created",
  service: "account",
  message: "Tài khoản đã được tạo, chờ cấp môi trường.",
  occurred_at: "2026-10-26T06:01:00.000002Z",
};
const rootEvent = event();
const member = { workspace_id: WID, roles: ["operator"], group_ids: [] };
const me = { subject: "fixture-operator", memberships: [member] };
const source = (id: string, name: string) => ({
  id,
  name,
  workspace_id: WID,
  service: name,
  parser_version: "v1",
});
export function Fixture() {
  const [tab, setTab] = useState("Sự kiện");
  const [workspace, setWorkspace] = useState({
    ...initialWorkspaceState(),
    status: "ready" as const,
    me,
    selectedWorkspaceId: WID,
    sources: {
      status: "ready" as const,
      items: [source(SID, "intake")],
      nextCursor: "page-2",
      error: null,
    },
  });
  const [events, setEvents] = useState({
    ...initialEventsState(scope()),
    list: { status: "ready" as const, items: sample.nodes, error: null },
  });
  const [selected, setSelected] = useState([SID]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(runFormDefaults(rootEvent));
  const [result, setResult] = useState("Chưa gửi thao tác");
  const [badPage, setBadPage] = useState(false);
  async function loadMoreSources() {
    if (badPage) {
      setResult("Giả lập lỗi nguồn: không đổi lựa chọn");
      return;
    }
    const second = workspace.sources.nextCursor === "page-2";
    setWorkspace((previous) => ({
      ...previous,
      sources: {
        ...previous.sources,
        items: [
          ...previous.sources.items,
          source(
            second
              ? "30000000-0000-4000-8000-000000000002"
              : "30000000-0000-4000-8000-000000000003",
            second ? "account" : "provision",
          ),
        ],
        nextCursor: second ? "page-3" : null,
      },
    }));
  }
  function record(value: unknown) {
    setResult(JSON.stringify(value));
  }
  return (
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          state: { status: "authenticated" },
          signIn: async () => {},
          signOut: async () => {},
          getAccessToken: async () => "",
        }}
      >
        <WorkspaceContext.Provider
          value={{
            state: workspace,
            membership: member,
            permissions: { canRead: true, canWrite: true, canVerify: false },
            loadMoreSources,
            refreshAccess: async () => {},
            selectWorkspace() {},
          }}
        >
          <EventsContext.Provider
            value={{
              state: events,
              setFilters: (filters) =>
                setEvents((previous) => ({
                  ...previous,
                  filters,
                  root: null,
                  detail: initialEventsState().detail,
                })),
              showEvent() {},
              refresh() {},
              previousPage() {},
              nextPage() {},
              retryDetail() {},
              selectRoot: () => true,
              clearRoot() {},
            }}
          >
            <header className="bg-chrome p-4 text-white">
              <h1 className="type-h2">TraceWeaver — Kiểm thử trải nghiệm</h1>
              <p>Dữ liệu mẫu cô lập; mọi thao tác chỉ trong memory.</p>
            </header>
            <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
              <nav className="flex flex-wrap gap-2" aria-label="Khu vực kiểm thử">
                {["Sự kiện", "Tái dựng", "Hồ sơ", "Tri thức"].map((name) => (
                  <Button key={name} onClick={() => setTab(name)}>
                    {name}
                  </Button>
                ))}
              </nav>
              {tab === "Sự kiện" && <EventsExplorer />}
              {tab === "Tái dựng" && (
                <>
                  <h2 className="type-h2">Chọn phạm vi và kiểm tra kết quả</h2>
                  <SourceScopePicker
                    rootSource={SID}
                    selected={selected}
                    disabled={false}
                    onChange={setSelected}
                    onBusy={setBusy}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={badPage}
                      onChange={(event) => setBadPage(event.target.checked)}
                    />
                    Giả lập cursor lặp
                  </label>
                  <PreciseDateTimeField
                    id="fixture-from"
                    label="Từ (UTC+7)"
                    value={form.from}
                    onChange={(from) => setForm((previous) => ({ ...previous, from }))}
                  />
                  <PreciseDateTimeField
                    id="fixture-to"
                    label="Đến (UTC+7)"
                    value={form.to}
                    onChange={(to) => setForm((previous) => ({ ...previous, to }))}
                  />
                  <Button
                    disabled={busy}
                    onClick={() => {
                      const value = { ...form, source_ids: selected };
                      const parsed = runFormSchema(rootEvent).safeParse(value);
                      record(
                        parsed.success ? toRunBody(parsed.data, rootEvent) : parsed.error.issues,
                      );
                    }}
                  >
                    Kiểm tra nội dung tạo
                  </Button>
                  <RunResult
                    state={{
                      ...initialReconstructionState(),
                      phase: "known",
                      run: run("completed", { degraded: true, degraded_reason: "ai_unavailable" }),
                      graph: sample,
                      graphStatus: "ready",
                    }}
                    retry={() => {}}
                    track={() => {}}
                    loadGraph={() => {}}
                    signIn={() => {}}
                    canWrite
                    linkActions={{
                      reviewLink: async (id, body) => record({ id, body }),
                      createManualLink: async (body) => record(body),
                      probeClosedCase() {},
                    }}
                  />
                </>
              )}
              {tab === "Hồ sơ" && <CaseDetailView detail={caseDetail()} />}
              {tab === "Tri thức" && (
                <KnowledgeResults
                  state={{
                    ...initialKnowledgeState(),
                    status: "ready",
                    items: [
                      {
                        id: "sample",
                        workspace_id: WID,
                        title: "Điều tra yêu cầu chưa hoàn tất",
                        body: "1. Tìm theo mã yêu cầu.\n2. Chọn sự kiện bắt đầu và đủ nguồn liên quan.\n3. Kiểm tra bằng chứng trước khi chấp nhận liên kết.",
                        source_ref: "https://example.com/guide",
                        version: 2,
                        author_subject: "fixture-author",
                        created_at: "2026-10-26T06:00:00Z",
                      },
                    ],
                  }}
                  refresh={() => {}}
                  previous={() => {}}
                  next={() => {}}
                  signIn={() => {}}
                />
              )}
              <section aria-label="Kết quả thao tác trong memory">
                <h2 className="type-h3">Kết quả kiểm thử</h2>
                <pre className="whitespace-pre-wrap break-all">{result}</pre>
              </section>
            </main>
          </EventsContext.Provider>
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
