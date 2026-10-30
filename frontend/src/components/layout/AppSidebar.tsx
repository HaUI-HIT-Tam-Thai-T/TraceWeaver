import { useState } from 'react';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useWorkspace } from '../../features/workspace/hooks/useWorkspace';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import { Button } from '../ui/Button';
import { NavLink } from 'react-router-dom';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { cn } from '../../lib/utils';
import Tooltip from '@mui/material/Tooltip';

const items = [
  { to: '/dashboard', label: 'Tổng quan', icon: DashboardOutlined },
  { to: '/events', label: 'Sự kiện', icon: TimelineOutlined },
  { to: '/cases', label: 'Hồ sơ', icon: FolderOpenOutlined },
  { to: '/knowledge', label: 'Tri thức', icon: MenuBookOutlined },
];

export function AppSidebar({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { state: auth, signOut } = useAuth();
  const { permissions } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setBusy(true);
    setError(null);
    try { await signOut(); onNavigate?.(); }
    catch { setError('Chưa hoàn tất đăng xuất. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <div className="chrome-surface flex h-full min-h-0 flex-col text-chrome-foreground">
    <nav aria-label="Điều hướng chính" className={cn('min-h-0 flex-1 space-y-2 overflow-y-auto', collapsed ? 'p-2' : 'p-4')}>
    {items.map(({ to, label, icon: Icon }) => (
      <Tooltip key={to} title={collapsed ? label : ''} placement="right" arrow disableInteractive><span className="block"><NavLink to={to} onClick={onNavigate} aria-label={label}
        className={({ isActive }) => cn(
          'type-label flex min-h-11 items-center gap-3 rounded-md py-3', collapsed ? 'justify-center px-2' : 'px-3',
          isActive ? 'bg-chrome-active font-semibold text-white' : 'text-chrome-muted hover:bg-chrome-active/60 hover:text-white',
        )}>
        <Icon sx={{ fontSize: '1.25rem' }} className="shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>{label}</span>
      </NavLink></span></Tooltip>
    ))}
    {auth.status === 'authenticated' && permissions.canAdmin && <Tooltip title={collapsed ? 'Quản trị workspace' : ''} placement="right" arrow disableInteractive><span className="block"><NavLink to="/workspace-admin" onClick={onNavigate} aria-label="Quản trị workspace"
      className={({ isActive }) => cn('type-label flex min-h-11 items-center gap-3 rounded-md py-3', collapsed ? 'justify-center px-2' : 'px-3', isActive ? 'bg-chrome-active font-semibold text-white' : 'text-chrome-muted hover:bg-chrome-active/60 hover:text-white')}>
      <AdminPanelSettingsOutlined sx={{ fontSize: '1.25rem' }} aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>Quản trị workspace</span>
    </NavLink></span></Tooltip>}
    </nav>
    {auth.status === 'authenticated' && <div className={cn('shrink-0 border-t border-white/20', collapsed ? 'p-2' : 'p-4')}>
      {error && <p role="alert" className="type-body-sm mb-3 text-white">{error}</p>}
      <Tooltip title={collapsed ? 'Đăng xuất' : ''} placement="right" arrow disableInteractive><span><Button variant="ghost" loading={busy} onClick={() => { void logout(); }} aria-label={busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
        className={cn('w-full gap-3 text-white hover:bg-chrome-active hover:text-white focus-visible:ring-white/60', collapsed ? 'justify-center px-2' : 'justify-start')}>
        <LogoutOutlined sx={{ fontSize: '1.25rem' }} aria-hidden="true" />
        <span className={collapsed ? 'sr-only' : undefined}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
      </Button></span></Tooltip>
    </div>}
  </div>;
}
