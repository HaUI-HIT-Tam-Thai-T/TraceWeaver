// Isolated UI fixture: fake contexts, no Keycloak or backend requests.
import { StrictMode, useEffect, useState } from "react";
import { DashboardTimeForm, DashboardCounters } from '../../src/features/dashboard/components/DashboardView';
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { AuthContext } from "../../src/features/auth/state/authContext";
import type { AuthState } from "../../src/features/auth/state/session";
import { WorkspaceContext } from "../../src/features/workspace/state/workspaceContext";
import {
  initialWorkspaceState,
  activeMembership,
  workspacePermissions,
} from "../../src/features/workspace/state/state";
import type { WorkspaceState } from "../../src/features/workspace/state/state";
import { AppLayout } from "../../src/components/layout/AppLayout";
import { WorkspaceAccessState } from "../../src/components/layout/WorkspaceAccessState";
import { ApiError } from "../../src/services/apiError";
import "../../src/index.css";

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
];
const memberships = ids.map((workspace_id, index) => ({
  workspace_id,
  roles: index === 0 ? ["viewer" as const] : ["ingest_service" as const],
  group_ids: [],
}));

export function FixturePage() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <section className="space-y-4">
      <h1 className="type-h1">Nội dung nghiệp vụ kiểm thử</h1>
      <DashboardTimeForm filters={{}} apply={() => {}} />
      <DashboardCounters data={{ runs: 13, degraded_runs: 4, unresolved_events: 9, waiting_cases: 5, filters: {} }} waiting={false} showWaiting={() => {}} />
      <p className="type-body">
        {loaded ? "Đã tải dữ liệu trong scope hiện tại." : "Đang chờ dữ liệu…"}
      </p>
      <Link to="/cases/88888888-8888-4888-8888-888888888888">
        Mở case detail
      </Link>
      <p className="type-body">
        Nội dung tiếng Việt dài để kiểm tra Header, Sidebar và Main không tràn
        ngang khi màn hình nhỏ.
      </p>
    </section>
  );
}
export function ShellFixture() {
  const [mode, setMode] = useState("ready");
  const [selected, setSelected] = useState(ids[0]);
  const [subject, setSubject] = useState("user-a");
  const [auth, setAuth] = useState<AuthState>({ status: "authenticated" });
  const initial = initialWorkspaceState();
  let state: WorkspaceState = {
    ...initial,
    status: "ready",
    selectedWorkspaceId: mode === "unselected" ? null : selected,
    me: { subject, memberships: mode === "none" ? [] : memberships },
  };
  if (mode === "loading") state = { ...initial, status: "loading" };
  if (mode === "error" || mode === "reauth")
    state = {
      ...initial,
      status: mode,
      error: new ApiError({
        kind: "http",
        status: mode === "reauth" ? 401 : 503,
        code: "TEST_ERROR",
        message: "Lỗi kiểm thử an toàn.",
        requestId: "fixture-request",
      }),
    };
  const membership = activeMembership(state);
  return (
    <AuthContext.Provider
      value={{
        state: auth,
        signIn: async () => setAuth({ status: "authenticated" }),
        signOut: async () => setAuth({ status: "unauthenticated" }),
        getAccessToken: async () => "",
      }}
    >
      <WorkspaceContext.Provider
        value={{
          state,
          membership,
          permissions: workspacePermissions(membership),
          selectWorkspace: (id) => {
            if (!ids.includes(id)) return false;
            setSelected(id);
            return true;
          },
          refreshAccess: async () => setMode("ready"),
          loadMoreSources: async () => {},
        }}
      >
        <div
          aria-label="Điều khiển fixture"
          className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas p-2 text-sm"
        >
          <span>Fixture cô lập — không gọi API</span>
          <label>
            Trạng thái kiểm thử{" "}
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="ready">Ready</option>
              <option value="loading">Revalidation</option>
              <option value="none">Không membership</option>
              <option value="unselected">Chưa chọn workspace</option>
              <option value="error">Lỗi quyền</option>
              <option value="reauth">401</option>
            </select>
          </label>
          <button
            onClick={() =>
              setSubject((previous) =>
                previous === "user-a" ? "user-b" : "user-a",
              )
            }
          >
            Đổi user
          </button>
        </div>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={<h1 className="type-h1">Trang chào kiểm thử</h1>}
            />
            <Route element={<WorkspaceAccessState />}>
              {[
                "/dashboard",
                "/events",
                "/cases",
                "/cases/:caseId",
                "/knowledge",
              ].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<FixturePage key={subject + selected} />}
                />
              ))}
            </Route>
          </Route>
        </Routes>
      </WorkspaceContext.Provider>
    </AuthContext.Provider>
  );
}
const container = document.getElementById("root");
if (container)
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter basename="/tests/fixtures/shell.html">
        <ShellFixture />
      </BrowserRouter>
    </StrictMode>,
  );
