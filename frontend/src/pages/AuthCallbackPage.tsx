import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/state/authContext";
import { AuthStatus } from "../features/auth/components/AuthStatus";

export function AuthCallbackPage() {
  const { state } = useAuth();
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Đăng nhập</h1>
      {state.status === "unauthenticated" && (
        <p>Đăng nhập chưa hoàn tất hoặc đã bị hủy.</p>
      )}
      <AuthStatus />
      <Link className="mt-4 block underline" to="/">
        Về trang chủ
      </Link>
    </>
  );
}
