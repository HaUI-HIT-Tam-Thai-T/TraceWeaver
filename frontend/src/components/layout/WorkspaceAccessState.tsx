import { PageHeading } from "./PageHeading";
import { useState } from "react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Button } from "../ui/Button";
import { Loader } from "../ui/Loader";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";

export function WorkspaceAccessState({ children }: { children?: ReactNode }) {
  const { signIn } = useAuth();
  const { state, membership, permissions, refreshAccess } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function login() {
    setBusy(true);
    setActionError(null);
    try {
      await signIn();
    } catch {
      setActionError("Không thể mở đăng nhập. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  const loginButton = (
    <Button
      loading={busy}
      onClick={() => {
        void login();
      }}
    >
      {busy ? "Đang chuyển hướng…" : "Đăng nhập lại"}
    </Button>
  );
  if (state.status === "idle" || state.status === "loading")
    return (
      <AccessFeedback title="Đang xác minh quyền truy cập">
        <Loader message="Đang kiểm tra workspace và quyền truy cập…" />
      </AccessFeedback>
    );
  if (state.status === "error" || state.status === "reauth")
    return (
      <AccessFeedback
        title={
          state.status === "reauth" ? "Cần đăng nhập lại" : "Chưa xác minh được quyền truy cập"
        }
      >
        <ErrorState
          message={state.error?.message ?? "Không thể xác minh quyền truy cập."}
          requestId={state.error?.requestId}
          action={
            state.status === "reauth" ? (
              loginButton
            ) : (
              <Button
                onClick={() => {
                  void refreshAccess();
                }}
              >
                Thử lại
              </Button>
            )
          }
        />
        {actionError && <ErrorState message={actionError} />}
      </AccessFeedback>
    );
  if (!state.me)
    return (
      <AccessFeedback title="Chưa xác minh được workspace">
        <ErrorState
          message="Không thể xác minh thông tin workspace."
          action={
            <Button
              onClick={() => {
                void refreshAccess();
              }}
            >
              Thử lại
            </Button>
          }
        />
      </AccessFeedback>
    );
  if (!state.me.memberships.length)
    return (
      <AccessFeedback title="Chưa có workspace">
        <EmptyState
          title="Tài khoản chưa được cấp workspace."
          description="Liên hệ quản trị viên để được cấp workspace và quyền phù hợp."
        />
      </AccessFeedback>
    );
  if (!state.selectedWorkspaceId)
    return (
      <AccessFeedback title="Chọn workspace">
        <EmptyState
          title="Vui lòng chọn workspace."
          description="Chọn workspace trên Header để xem nội dung."
        />
      </AccessFeedback>
    );
  if (!membership || !permissions.canRead)
    return (
      <AccessFeedback title="Chưa có quyền đọc dữ liệu">
        <EmptyState
          title="Workspace này chưa có quyền đọc dữ liệu."
          description="Bạn có thể chọn workspace khác trên Header hoặc liên hệ quản trị viên."
        />
      </AccessFeedback>
    );
  return children === undefined ? <Outlet /> : children;
}

function AccessFeedback({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <PageHeading title={title} />
      {children}
    </section>
  );
}
