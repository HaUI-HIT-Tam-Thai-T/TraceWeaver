import { PageHeading } from "../../../components/layout/PageHeading";
import type { ReactNode } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";

export function CasesLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { state: auth } = useAuth();
  const { state: workspace, permissions } = useWorkspace();
  let content = children;
  if (auth.status !== "authenticated") content = <p>Đăng nhập để xem hồ sơ.</p>;
  else if (workspace.status !== "ready")
    content = <p>Workspace và quyền truy cập chưa sẵn sàng.</p>;
  else if (!workspace.selectedWorkspaceId)
    content = <p>Chọn workspace để xem hồ sơ.</p>;
  else if (!permissions.canRead)
    content = <p>Vai trò hiện tại không có quyền đọc hồ sơ.</p>;
  return (
    <>
      <PageHeading
        actions={
          auth.status === "authenticated" &&
          workspace.status === "ready" &&
          permissions.canRead
            ? actions
            : undefined
        }
        title={title}
      />
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
