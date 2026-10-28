import { useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useWorkspace } from '../../features/workspace/hooks/useWorkspace';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

export function WorkspaceAccessState({ children }: { children?: ReactNode }) {
  const { state: auth, signIn } = useAuth();
  const { state, membership, permissions, refreshAccess } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function login() {
    setBusy(true);
    setActionError(null);
    try { await signIn(); }
    catch { setActionError('Không thể mở đăng nhập. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  const loginButton = <Button loading={busy} onClick={() => { void login(); }}>{busy ? 'Đang chuyển hướng…' : 'Đăng nhập lại'}</Button>;
  if (auth.status === 'initializing') return <LoadingState message="Đang kiểm tra phiên đăng nhập…" />;
  if (auth.status === 'error') return <ErrorState message={auth.message}
    action={auth.reason === 'initialization'
      ? <Button onClick={() => window.location.reload()}>Tải lại trang</Button> : loginButton} />;
  if (auth.status !== 'authenticated') return <div className="space-y-4">
    <EmptyState title="Vui lòng đăng nhập để tiếp tục." description={auth.message}
      action={<Button loading={busy} onClick={() => { void login(); }}>Đăng nhập</Button>} />
    {actionError && <ErrorState message={actionError} />}
  </div>;
  if (state.status === 'idle' || state.status === 'loading') return <LoadingState message="Đang kiểm tra workspace và quyền truy cập…" />;
  if (state.status === 'error' || state.status === 'reauth') return <div className="space-y-4">
    <ErrorState message={state.error?.message ?? 'Không thể xác minh quyền truy cập.'} requestId={state.error?.requestId}
      action={state.status === 'reauth' ? loginButton : <Button onClick={() => { void refreshAccess(); }}>Thử lại</Button>} />
    {actionError && <ErrorState message={actionError} />}
  </div>;
  if (!state.me) return <ErrorState message="Không thể xác minh thông tin workspace."
    action={<Button onClick={() => { void refreshAccess(); }}>Thử lại</Button>} />;
  if (!state.me.memberships.length) return <EmptyState title="Tài khoản chưa được cấp workspace." />;
  if (!state.selectedWorkspaceId) return <EmptyState title="Vui lòng chọn workspace." description="Chọn workspace trên Header để xem nội dung." />;
  if (!membership || !permissions.canRead) return <EmptyState title="Workspace này chưa có quyền đọc dữ liệu." description="Bạn có thể chọn workspace khác trên Header hoặc liên hệ quản trị viên." />;
  return children === undefined ? <Outlet /> : children;
}
