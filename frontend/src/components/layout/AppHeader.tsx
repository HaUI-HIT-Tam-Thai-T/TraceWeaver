import { useState } from 'react';
import { Link } from 'react-router-dom';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useWorkspace } from '../../features/workspace/hooks/useWorkspace';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WorkspacePicker } from '../../features/workspace/components/WorkspacePicker';
import { SheetTrigger } from '../ui/primitives/sheet';

export function AppHeader() {
  const { state: auth, signIn } = useAuth();
  const { state, membership, selectWorkspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const authenticated = auth.status === 'authenticated';
  const ready = authenticated && state.status === 'ready';
  const memberships = ready ? state.me?.memberships ?? [] : [];
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try { await action(); }
    catch { setActionError('Không thể hoàn tất thao tác. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <header className="sticky top-0 z-30 border-b border-white/20 bg-chrome text-chrome-foreground lg:h-16 chrome-surface">
    <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 lg:h-full lg:flex-nowrap lg:gap-0 lg:px-0 lg:py-0">
      <SheetTrigger asChild>
        <Button variant="secondary" type="button" aria-label="Mở menu điều hướng" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white lg:hidden">
          <ChevronRight sx={{ fontSize: '1.25rem' }} aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <div className="header-brand flex shrink-0 items-center">
        <Link to="/dashboard" aria-label="TraceWeaver" title="TraceWeaver" className="type-h3 shrink-0 text-white lg:px-6">
          <span className="header-brand-full">TraceWeaver</span><span className="header-brand-compact">TW</span>
        </Link>
      </div>
      <div className="order-last flex w-full min-w-0 lg:order-none lg:w-auto lg:flex-1 lg:pl-6 xl:pl-8">
        <div className="min-w-0 flex-1 lg:max-w-md">
          <label htmlFor="workspace-picker" className="type-caption mb-1 block text-chrome-muted lg:sr-only">Chọn workspace</label>
          <WorkspacePicker key={ready ? state.me?.subject : 'unavailable'}
            workspaceIds={memberships.map(item => item.workspace_id)}
            selectedId={ready ? state.selectedWorkspaceId : null}
            disabled={!ready || !memberships.length || busy}
            initializing={authenticated && (state.status === 'loading' || state.status === 'idle')}
            onSelect={selectWorkspace} />
        </div>
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 lg:px-6">
        {ready && membership && <div aria-label="Vai trò workspace" className="hidden flex-wrap gap-1 lg:flex">
          {membership.roles.map(role => <Badge key={role} tone="info" className="text-chrome-muted">{role}</Badge>)}
        </div>}
        {!authenticated && <Button variant="secondary" loading={busy} disabled={auth.status === 'initializing'}
          className="border-white/30 bg-white text-chrome hover:bg-white/90 focus-visible:ring-white/60"
          onClick={() => {
            if (auth.status === 'error' && auth.reason === 'initialization') window.location.reload();
            else void act(signIn);
          }}>
          {busy ? 'Đang chuyển hướng…' : auth.status === 'error' && auth.reason === 'initialization' ? 'Tải lại trang' : 'Đăng nhập'}
        </Button>}
      </div>
    </div>
    {ready && membership && <div className="flex flex-wrap gap-1 px-4 pb-2 lg:hidden" aria-label="Vai trò workspace">
      {membership.roles.map(role => <Badge key={role} tone="info" className="text-chrome-muted">{role}</Badge>)}
    </div>}
    {actionError && <p role="alert" className="type-body-sm px-4 pb-2 text-white">{actionError}</p>}
  </header>;
}
