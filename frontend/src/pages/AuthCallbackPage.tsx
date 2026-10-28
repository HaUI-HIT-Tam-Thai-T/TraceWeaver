import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import { AuthStatus } from "../features/auth/components/AuthStatus";

export function AuthCallbackPage() {
  const { state } = useAuth();
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return (
    <>
      <h1 className="type-h1 mb-4">Đăng nhập</h1>
      {state.status === "unauthenticated" && (
        <p className="type-body mb-4">Đăng nhập chưa hoàn tất hoặc đã bị hủy.</p>
      )}
      <AuthStatus />
      <Link className="type-label mt-4 block underline" to="/">
        Về trang chủ
      </Link>
    </>
  );
}
