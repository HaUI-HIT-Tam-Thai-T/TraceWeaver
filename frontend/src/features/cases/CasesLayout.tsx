import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { AuthStatus } from "../auth/AuthStatus";
import { useWorkspace } from "../workspace/workspaceContext";
import { WorkspacePanel } from "../workspace/WorkspacePanel";

export function CasesLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { state: auth } = useAuth();
  const { state: workspace, permissions } = useWorkspace();
  let content = children;
  if (auth.status !== "authenticated") content = <p>Đăng nhập để xem cases.</p>;
  else if (workspace.status !== "ready")
    content = <p>Workspace và quyền truy cập chưa sẵn sàng.</p>;
  else if (!workspace.selectedWorkspaceId)
    content = <p>Chọn workspace để xem cases.</p>;
  else if (!permissions.canRead)
    content = <p>Vai trò hiện tại không có quyền đọc cases.</p>;
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      <nav className="mb-4 space-x-4" aria-label="Điều hướng cases">
        <Link to="/">Trang chủ</Link>
        <Link to="/cases">Danh sách cases</Link>
        <Link to="/events">Event explorer</Link>
      </nav>
      <AuthStatus />
      <WorkspacePanel />
      <div key={JSON.stringify([workspace.me?.subject, workspace.selectedWorkspaceId])}>{content}</div>
    </>
  );
}
