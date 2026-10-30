// Isolated UI fixture: no login redirect or backend request.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthContext } from "../../src/features/auth/state/authContext";
import type { AuthState } from "../../src/features/auth/state/session";
import { WorkspaceContext } from "../../src/features/workspace/state/workspaceContext";
import {
  initialWorkspaceState,
  activeMembership,
  workspacePermissions,
} from "../../src/features/workspace/state/state";
import { ProtectedRoute } from "../../src/routes/ProtectedRoute";
import { WorkspaceAccessState } from "../../src/components/layout/WorkspaceAccessState";
import { PageLoading } from "../../src/routes/PageLoadFeedback";
import "../../src/index.css";

export function Fixture() {
  const [mode, setMode] = useState("initializing");
  const [logins, setLogins] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const member = {
    workspace_id: "10000000-0000-4000-8000-000000000001",
    workspace_name: "Workspace kiểm thử",
    roles: ["viewer" as const],
    group_ids: [],
  };
  let auth: AuthState = { status: "authenticated" };
  if (mode === "initializing") auth = { status: "initializing" };
  else if (mode === "guest") auth = { status: "unauthenticated", message: "Phiên đã hết hạn." };
  else if (mode === "error")
    auth = {
      status: "error",
      reason: "initialization",
      message: "Không thể kết nối dịch vụ đăng nhập.",
    };
  const workspace = initialWorkspaceState();
  workspace.status =
    mode === "workspace-loading" ? "loading" : mode === "reauth" ? "reauth" : "ready";
  if (workspace.status === "ready") {
    workspace.me = { subject: "fixture-viewer", memberships: [member] };
    workspace.selectedWorkspaceId = member.workspace_id;
  }
  const membership = activeMembership(workspace);
  const permissions = workspacePermissions(membership);
  if (mode === "denied") permissions.canRead = false;
  return (
    <AuthContext.Provider
      value={{
        state: auth,
        signIn: async () => {
          setLogins((value) => value + 1);
        },
        signOut: async () => {},
        getAccessToken: async () => {
          throw Error("No real token");
        },
      }}
    >
      <WorkspaceContext.Provider
        value={{
          state: workspace,
          membership,
          permissions,
          selectWorkspace: () => false,
          refreshAccess: async () => {},
          loadMoreSources: async () => {},
        }}
      >
        <main className="mx-auto max-w-3xl space-y-6 p-5">
          <label className="block">
            Trạng thái fixture{" "}
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="initializing">Đang kiểm tra phiên</option>
              <option value="guest">Chưa đăng nhập</option>
              <option value="ready">Đã xác thực, có quyền đọc</option>
              <option value="workspace-loading">Đang kiểm tra quyền</option>
              <option value="denied">Không có quyền đọc</option>
              <option value="reauth">API yêu cầu đăng nhập lại</option>
              <option value="error">Lỗi khởi tạo phiên</option>
            </select>
          </label>
          <p>Lần mở đăng nhập: {logins}</p>
          <Link to="/tests/fixtures/protected-route.html?tab=reconstruction">
            Mở đường dẫn hồ sơ kiểm thử
          </Link>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<WorkspaceAccessState />}>
                <Route
                  path="*"
                  element={
                    <section className="ui-panel space-y-4">
                      <h1>Hồ sơ được bảo vệ</h1>
                      <p>Dữ liệu hồ sơ chỉ xuất hiện sau khi xác thực và có quyền đọc.</p>
                      <button type="button" onClick={() => setShowLoader((value) => !value)}>
                        Bật/tắt loader trang
                      </button>
                      {showLoader && <PageLoading />}
                    </section>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </main>
      </WorkspaceContext.Provider>
    </AuthContext.Provider>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <BrowserRouter>
      <Fixture />
    </BrowserRouter>,
  );
