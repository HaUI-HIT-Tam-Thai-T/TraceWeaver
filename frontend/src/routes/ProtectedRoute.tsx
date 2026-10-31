import { useState } from "react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PageHeading } from "../components/layout/PageHeading";
import { Button } from "../components/ui/Button";
import { Loader } from "../components/ui/Loader";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { state, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function login() {
    if (busy) return;
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
  if (state.status === "authenticated") return children === undefined ? <Outlet /> : children;
  if (state.status === "initializing")
    return (
      <section className="mx-auto w-full max-w-2xl space-y-4">
        <PageHeading title="Đang kiểm tra đăng nhập" />
        <Loader message="Đang kiểm tra phiên đăng nhập…" />
      </section>
    );
  const failed = state.status === "error";
  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <PageHeading
        title={failed ? "Không thể xác minh phiên đăng nhập" : "Đăng nhập để tiếp tục"}
      />
      {failed ? (
        <ErrorState
          message={state.message}
          action={
            state.reason === "initialization" ? (
              <Button type="button" onClick={() => window.location.reload()}>
                Tải lại trang
              </Button>
            ) : (
              <Button type="button" loading={busy} onClick={() => void login()}>
                Đăng nhập lại
              </Button>
            )
          }
        />
      ) : (
        <EmptyState
          title="Vui lòng đăng nhập để tiếp tục."
          description={state.message}
          action={
            <Button type="button" loading={busy} onClick={() => void login()}>
              {busy ? "Đang chuyển hướng…" : "Đăng nhập"}
            </Button>
          }
        />
      )}
      {actionError && <ErrorState message={actionError} />}
    </section>
  );
}
