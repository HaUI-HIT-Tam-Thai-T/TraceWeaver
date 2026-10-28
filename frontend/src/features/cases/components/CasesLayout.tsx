import type { ReactNode } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";

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
      <h1 className="type-h1 mb-6">{title}</h1>
      <div
        key={JSON.stringify([
          workspace.me?.subject,
          workspace.selectedWorkspaceId,
        ])}
      >
        {content}
      </div>
    </>
  );
}
