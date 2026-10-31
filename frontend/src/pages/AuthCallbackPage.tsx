import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthStatus } from "../features/auth/components/AuthStatus";

export function AuthCallbackPage() {
  const { state } = useAuth();
  if (state.status === "authenticated") return <Navigate to="/dashboard" replace />;
  return (
    <>
      <h1 className="type-h1 mb-4">Đăng nhập</h1>
      {state.status === "unauthenticated" && (
        <p className="type-body mb-4">Đăng nhập chưa hoàn tất hoặc đã bị hủy.</p>
      )}
      <AuthStatus />
      <Link className="type-label mt-4 block underline" to="/dashboard">
        Về Tổng quan
      </Link>
    </>
  );
}
