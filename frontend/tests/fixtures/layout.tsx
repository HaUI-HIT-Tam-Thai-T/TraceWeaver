import { PublicLayout } from "../../src/components/layout/PublicLayout";
import { AuthCallbackPage } from "../../src/pages/AuthCallbackPage";
import { NotFoundPage } from "../../src/pages/NotFoundPage";
// Production components, isolated contexts: no HTTP/auth calls or backend mutations.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../src/features/auth/state/authContext";
import { WorkspaceContext } from "../../src/features/workspace/state/workspaceContext";
import {
  initialWorkspaceState,
  workspacePermissions,
} from "../../src/features/workspace/state/state";
import { EventsContext } from "../../src/features/events/state/eventsContext";
import { initialEventsState } from "../../src/features/events/state/state";
import { CasesContext } from "../../src/features/cases/state/casesContext";
import { initialCasesState } from "../../src/features/cases/state/state";
import { AppLayout } from "../../src/components/layout/AppLayout";
import { WorkspaceAccessState } from "../../src/components/layout/WorkspaceAccessState";
import { PageHeading } from "../../src/components/layout/PageHeading";
import { CasesPage } from "../../src/pages/CasesPage";
import { CaseDetailPage } from "../../src/pages/CaseDetailPage";
import { EventsPage } from "../../src/pages/EventsPage";
import {
  DashboardCounters,
  DashboardTimeForm,
} from "../../src/features/dashboard/components/DashboardView";
import {
  KnowledgeSearchForm,
  KnowledgeResults,
} from "../../src/features/knowledge/components/KnowledgeView";
import { initialKnowledgeState } from "../../src/features/knowledge/state/controller";
import { RunResult } from "../../src/features/reconstruction/components/RunResult";
import { initialReconstructionState } from "../../src/features/reconstruction/state/state";
import { LoadingState } from "../../src/components/ui/LoadingState";
import { event, WID, SID } from "../event-fixtures.mjs";
import { graph, run } from "../reconstruction-fixtures.mjs";
import { caseDetail, CID } from "../case-fixtures.mjs";
import "../../src/index.css";

const detail = caseDetail();
detail.case.title = "Yêu cầu cấp môi trường chưa hoàn tất";
detail.evidence[0].note =
  "Đã kiểm tra dịch vụ cấp môi trường. Cần đối chiếu tài nguyên trước khi thử lại.";
detail.history[0].reason = "Tạo hồ sơ để kiểm tra yêu cầu chưa hoàn tất.";
const sample = graph();
sample.nodes[0].message = "Đã tiếp nhận yêu cầu REQ-2026-01.";
sample.nodes[1] = {
  ...sample.nodes[1],
  action: "account.created",
  message: "Đã tạo tài khoản, đang chờ cấp môi trường.",
};
const noop = () => {};
function FixtureHistory() {
  const navigate = useNavigate();
  return (
    <span className="flex gap-2">
      <button onClick={() => navigate(-1)}>Quay lại</button>
      <button onClick={() => navigate(1)}>Đi tiếp</button>
      <Link to="/auth/callback">Callback kiểm thử</Link>
      <Link to="/missing-page">404 kiểm thử</Link>
    </span>
  );
}
export function LayoutFixture() {
  const [mode, setMode] = useState("ready");
  const [role, setRole] = useState<"operator" | "viewer" | "reviewer">("operator");
  const [result, setResult] = useState("Chưa ghi thao tác");
  const [events, setEvents] = useState({
    ...initialEventsState(),
    status: "active" as const,
    list: { status: "ready" as const, items: sample.nodes, error: null },
    detail: {
      status: "ready" as const,
      event: sample.nodes[0],
      id: sample.nodes[0].event_id,
      error: null,
    },
  });
  const [filters, setFilters] = useState({ limit: 50 });
  const member = { workspace_id: WID, roles: [role], group_ids: [] };
  const me = { subject: "fixture-operator", memberships: [member] };
  const permissions = workspacePermissions(member);
  const access = {
    subject: me.subject,
    workspaceId: WID,
    accessKey: me,
    canWrite: permissions.canWrite,
    canVerify: permissions.canVerify,
  };
  const workspace = {
    ...initialWorkspaceState(),
    status: "ready" as const,
    me,
    selectedWorkspaceId: WID,
    sources: {
      status: "ready" as const,
      items: [
        { id: SID, workspace_id: WID, name: "intake", service: "intake", parser_version: "v1" },
      ],
      nextCursor: null,
      error: null,
    },
  };
  const cases = {
    ...initialCasesState(access, filters),
    list: { status: "ready" as const, items: [detail.case], error: null },
    detail: { status: "ready" as const, id: CID, data: detail, error: null },
    snapshot: {
      status: "ready" as const,
      runId: detail.case.run_id,
      events: sample.nodes,
      error: null,
    },
  };
  const record = async (value: unknown) => {
    setResult(JSON.stringify(value));
  };
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthContext.Provider
        value={{
          state: { status: mode === "logout" ? "unauthenticated" : "authenticated" },
          signIn: async () => {},
          signOut: async () => setMode("logout"),
          getAccessToken: async () => "",
        }}
      >
        <WorkspaceContext.Provider
          value={{
            state: mode === "ready" ? workspace : { ...initialWorkspaceState(), status: "loading" },
            membership: mode === "ready" ? member : null,
            permissions,
            refreshAccess: async () => setMode("ready"),
            loadMoreSources: async () => {},
            selectWorkspace: () => false,
          }}
        >
          <EventsContext.Provider
            value={{
              state: events,
              setFilters: (filters) => setEvents((previous) => ({ ...previous, filters })),
              showEvent: (id) =>
                setEvents((previous) => ({
                  ...previous,
                  detail: { ...previous.detail, id, event: id ? sample.nodes[0] : null },
                })),
              refresh: noop,
              previousPage: noop,
              nextPage: noop,
              retryDetail: noop,
              selectRoot: () => false,
              clearRoot: noop,
            }}
          >
            <CasesContext.Provider
              value={{
                state: cases,
                setFilters,
                refresh: noop,
                previousPage: noop,
                nextPage: noop,
                submitEvidence: record,
                loadEvidenceSnapshot: async () => {},
                beginNewEvidence: noop,
                submitTransition: record,
                retryTransition: async () => {},
                beginNewTransition: noop,
              }}
            >
              <div
                className="flex flex-wrap items-center gap-3 bg-control p-2 type-caption"
                aria-label="Điều khiển fixture"
              >
                <span>Fixture cô lập — không gọi API</span>
                <label>
                  Trạng thái{" "}
                  <select value={mode} onChange={(event) => setMode(event.target.value)}>
                    <option value="ready">Ready</option>
                    <option value="loading">Revalidation</option>
                    <option value="logout">Logout</option>
                  </select>
                </label>
                <label>
                  Vai trò{" "}
                  <select
                    value={role}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "operator" || next === "viewer" || next === "reviewer")
                        setRole(next);
                    }}
                  >
                    <option>operator</option>
                    <option>viewer</option>
                    <option>reviewer</option>
                  </select>
                </label>
                <Link to={`/cases/${CID}`}>Mở hồ sơ</Link>
                <FixtureHistory />
              </div>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route element={<WorkspaceAccessState />}>
                    <Route
                      path="/dashboard"
                      element={
                        <>
                          <PageHeading
                            title="Tổng quan"
                            description="Kết quả tái dựng và hồ sơ cần xử lý trong workspace hiện tại."
                          />
                          <DashboardTimeForm filters={{}} apply={(value) => void record(value)} />
                          <DashboardCounters
                            data={{
                              runs: 13,
                              degraded_runs: 4,
                              unresolved_events: 9,
                              waiting_cases: 5,
                              filters: {},
                            }}
                            waiting={false}
                            showWaiting={noop}
                          />
                          <LoadingState message="Mẫu khung tải dữ liệu" variant="counters" />
                        </>
                      }
                    />
                    <Route
                      path="/events"
                      element={
                        <>
                          <EventsPage />
                          <RunResult
                            state={{
                              ...initialReconstructionState(),
                              run: run(),
                              graph: sample,
                              graphStatus: "ready",
                              phase: "known",
                            }}
                            retry={noop}
                            track={noop}
                            loadGraph={noop}
                            signIn={noop}
                          />
                        </>
                      }
                    />
                    <Route path="/cases" element={<CasesPage />} />
                    <Route path="/cases/:caseId" element={<CaseDetailPage />} />
                    <Route
                      path="/knowledge"
                      element={
                        <>
                          <PageHeading
                            title="Tri thức"
                            description="Hướng dẫn và tài liệu tham khảo cho quá trình điều tra."
                          />
                          <KnowledgeSearchForm
                            filters={{ limit: 50 }}
                            apply={(value) => void record(value)}
                          />
                          <KnowledgeResults
                            state={{
                              ...initialKnowledgeState(),
                              status: "ready",
                              items: [
                                {
                                  id: CID,
                                  workspace_id: WID,
                                  title: "Kiểm tra yêu cầu chưa hoàn tất",
                                  body: "Tìm log bằng mã yêu cầu.\n\nChọn sự kiện bắt đầu, đủ nguồn và khoảng thời gian phù hợp. Đối chiếu bằng chứng trước khi duyệt liên kết.",
                                  version: 2,
                                  author_subject: "fixture-author",
                                  source_ref: "https://example.com/guide",
                                  created_at: event().occurred_at,
                                },
                              ],
                            }}
                            refresh={noop}
                            previous={noop}
                            next={noop}
                            signIn={noop}
                          />
                        </>
                      }
                    />
                  </Route>
                </Route>
                <Route element={<PublicLayout />}>
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <output className="block break-all p-4 type-caption" aria-label="Kết quả fixture">
                {result}
              </output>
            </CasesContext.Provider>
          </EventsContext.Provider>
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}
const root = document.getElementById("root");
if (root) {
  const appRoot = createRoot(root);
  appRoot.render(
    <StrictMode>
      <LayoutFixture />
    </StrictMode>,
  );
  if (import.meta.hot) import.meta.hot.dispose(() => appRoot.unmount());
}
