import { useState } from "react";
import { useAuth } from "./authContext";

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

  const buttonClass =
    "mt-4 rounded border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
  if (state.status === "initializing")
    return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (state.status === "error") {
    return (
      <section aria-label="Trạng thái đăng nhập">
        <p role="alert">{state.message}</p>
        <button
          className={buttonClass}
          type="button"
          onClick={() => window.location.reload()}
        >
          Tải lại trang
        </button>
      </section>
    );
  }
  const authenticated = state.status === "authenticated";
  return (
    <section aria-label="Trạng thái đăng nhập">
      <p role="status">
        {authenticated
          ? "Đã đăng nhập."
          : (state.message ?? "Bạn chưa đăng nhập.")}
      </p>
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={() => {
          void handleAction(authenticated ? signOut : signIn);
        }}
      >
        {busy
          ? "Đang chuyển hướng…"
          : authenticated
            ? "Đăng xuất"
            : "Đăng nhập"}
      </button>
    </section>
  );
}
