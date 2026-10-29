import { PageHeading } from "./PageHeading";
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
  if (auth.status === 'initializing') return <AccessFeedback title="Đang kiểm tra đăng nhập"><LoadingState message="Đang kiểm tra phiên đăng nhập…" /></AccessFeedback>;
  if (auth.status === 'error') return <AccessFeedback title="Không thể xác minh phiên đăng nhập"><ErrorState message={auth.message}
    action={auth.reason === 'initialization'
      ? <Button onClick={() => window.location.reload()}>Tải lại trang</Button> : loginButton} /></AccessFeedback>;
  if (auth.status !== 'authenticated') return <AccessFeedback title="Đăng nhập để tiếp tục">
    <EmptyState title="Vui lòng đăng nhập để tiếp tục." description={auth.message}
      action={<Button loading={busy} onClick={() => { void login(); }}>Đăng nhập</Button>} />
    {actionError && <ErrorState message={actionError} />}
  </AccessFeedback>;
  if (state.status === 'idle' || state.status === 'loading') return <AccessFeedback title="Đang xác minh quyền truy cập"><LoadingState message="Đang kiểm tra workspace và quyền truy cập…" /></AccessFeedback>;
  if (state.status === 'error' || state.status === 'reauth') return <AccessFeedback title={state.status === 'reauth' ? 'Cần đăng nhập lại' : 'Chưa xác minh được quyền truy cập'}>
    <ErrorState message={state.error?.message ?? 'Không thể xác minh quyền truy cập.'} requestId={state.error?.requestId}
      action={state.status === 'reauth' ? loginButton : <Button onClick={() => { void refreshAccess(); }}>Thử lại</Button>} />
    {actionError && <ErrorState message={actionError} />}
  </AccessFeedback>;
  if (!state.me) return <AccessFeedback title="Chưa xác minh được workspace"><ErrorState message="Không thể xác minh thông tin workspace."
    action={<Button onClick={() => { void refreshAccess(); }}>Thử lại</Button>} /></AccessFeedback>;
  if (!state.me.memberships.length) return <AccessFeedback title="Chưa có workspace"><EmptyState title="Tài khoản chưa được cấp workspace." description="Liên hệ quản trị viên để được cấp workspace và quyền phù hợp." /></AccessFeedback>;
  if (!state.selectedWorkspaceId) return <AccessFeedback title="Chọn workspace"><EmptyState title="Vui lòng chọn workspace." description="Chọn workspace trên Header để xem nội dung." /></AccessFeedback>;
  if (!membership || !permissions.canRead) return <AccessFeedback title="Chưa có quyền đọc dữ liệu"><EmptyState title="Workspace này chưa có quyền đọc dữ liệu." description="Bạn có thể chọn workspace khác trên Header hoặc liên hệ quản trị viên." /></AccessFeedback>;
  return children === undefined ? <Outlet /> : children;
}

function AccessFeedback({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mx-auto w-full max-w-2xl space-y-4"><PageHeading title={title} />{children}</section>;
}
