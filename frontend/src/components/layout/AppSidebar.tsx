import { useState } from 'react';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { Button } from '../ui/Button';
import { NavLink } from 'react-router-dom';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { cn } from '../../lib/utils';

const items = [
  { to: '/dashboard', label: 'Tổng quan', icon: DashboardOutlined },
  { to: '/events', label: 'Sự kiện', icon: TimelineOutlined },
  { to: '/cases', label: 'Cases', icon: FolderOpenOutlined },
  { to: '/knowledge', label: 'Tri thức', icon: MenuBookOutlined },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { state: auth, signOut } = useAuth();
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
    <nav aria-label="Điều hướng chính" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
    {items.map(({ to, label, icon: Icon }) => (
      <NavLink key={to} to={to} onClick={onNavigate}
        className={({ isActive }) => cn(
          'type-label flex min-h-11 items-center gap-3 rounded-md px-3 py-3',
          isActive ? 'bg-chrome-active font-semibold text-white' : 'text-chrome-muted hover:bg-chrome-active/60 hover:text-white',
        )}>
        <Icon sx={{ fontSize: '1.25rem' }} className="shrink-0" aria-hidden="true" />{label}
      </NavLink>
    ))}
    </nav>
    {auth.status === 'authenticated' && <div className="shrink-0 border-t border-white/20 p-4">
      {error && <p role="alert" className="type-body-sm mb-3 text-white">{error}</p>}
      <Button variant="ghost" loading={busy} onClick={() => { void logout(); }}
        className="w-full justify-start gap-3 text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/60">
        <LogoutOutlined sx={{ fontSize: '1.25rem' }} aria-hidden="true" />
        {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </Button>
    </div>}
  </div>;
}
