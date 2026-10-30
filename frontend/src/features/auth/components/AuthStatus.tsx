import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Loader } from "../../../components/ui/Loader";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useAuth } from "../hooks/useAuth";

export function AuthStatus() {
  const { state, signIn, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "initializing")
    return <Loader message="Đang kiểm tra phiên đăng nhập…" />;
  if (state.status === "error") {
    return (
      <section className="ui-panel space-y-4" aria-label="Trạng thái đăng nhập">
        <ErrorState message={state.message} />
        <Button
          type="button"
          onClick={() => window.location.reload()}
        >
          Tải lại trang
        </Button>
      </section>
    );
  }
  const authenticated = state.status === "authenticated";
  return (
    <section className="ui-panel space-y-4" aria-label="Trạng thái đăng nhập">
      <div>
        <h2 className="type-h2 mb-3">Phiên đăng nhập</h2>
        <Badge tone={authenticated ? "success" : "neutral"}>
          {authenticated ? "Đã xác thực" : "Chưa xác thực"}
        </Badge>
      </div>
      <p role="status" className="type-body-sm text-muted">
        {authenticated
          ? "Đã đăng nhập."
          : (state.message ?? "Bạn chưa đăng nhập.")}
      </p>
      <Button
        type="button"
        loading={busy}
        onClick={() => {
          void handleAction(authenticated ? signOut : signIn);
        }}
      >
        {busy
          ? "Đang chuyển hướng…"
          : authenticated
            ? "Đăng xuất"
            : "Đăng nhập"}
      </Button>
    </section>
  );
}
