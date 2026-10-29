import { usePageTitle } from "../../hooks/usePageTitle";
import { Button } from '../ui/Button';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/primitives/sheet';
import { PageLoading } from '../../routes/PageLoadFeedback';

export function AppLayout() {
  usePageTitle();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  useEffect(() => {
    function closeAfterNavigation() { setMobileOpen(false); }
    closeAfterNavigation();
  }, [location.key]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    function closeOnDesktop() { if (desktop.matches) setMobileOpen(false); }
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-panel focus:p-3 focus:text-focus">Bỏ qua điều hướng</a>
    <div className="app-shell min-h-dvh" data-sidebar-collapsed={sidebarCollapsed}>
      <AppHeader />
      <div className="flex items-start">
        <div data-collapsed={sidebarCollapsed} className="desktop-sidebar sticky top-16 z-20 hidden h-[calc(100dvh-4rem)] shrink-0 lg:block">
          <aside id="desktop-sidebar" aria-label="Thanh bên" aria-hidden={sidebarCollapsed} inert={sidebarCollapsed} className="h-full overflow-hidden">
            <div className="desktop-sidebar-content h-full bg-chrome"><AppSidebar /></div>
          </aside>
          <Button variant="secondary" type="button" onClick={() => setSidebarCollapsed(previous => !previous)}
            aria-controls="desktop-sidebar" aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Mở thanh bên' : 'Thu gọn thanh bên'}
            className="sidebar-toggle absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-l-md rounded-r-full border border-line bg-panel text-foreground shadow-md hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-focus">
            {sidebarCollapsed
              ? <ChevronRight sx={{ fontSize: '1.5rem' }} aria-hidden="true" />
              : <ChevronLeft sx={{ fontSize: '1.5rem' }} aria-hidden="true" />}
          </Button>
        </div>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
          <div className="page-container"><Suspense fallback={<PageLoading />}><Outlet /></Suspense></div>
        </main>
      </div>
    </div>
    <SheetContent showCloseButton={false} aria-modal="true" side="left" className="mobile-sidebar-sheet chrome-surface h-dvh w-[min(20rem,85vw)] gap-0 border-white/20 bg-chrome p-0 text-white [&_[data-slot=sheet-title]]:text-white [&_[data-slot=sheet-description]]:text-chrome-muted">
      <SheetClose asChild>
        <Button variant="secondary" type="button" aria-label="Đóng menu" className="absolute -right-5 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-l-md rounded-r-full border border-line bg-panel text-foreground shadow-md hover:border-primary hover:bg-primary hover:text-white">
          <ChevronRight sx={{ fontSize: '1.5rem' }} aria-hidden="true" />
        </Button>
      </SheetClose>
      <SheetHeader className="shrink-0 border-b border-white/20 pr-12">
        <SheetTitle>Điều hướng TraceWeaver</SheetTitle>
        <SheetDescription>Chọn chức năng cần mở.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1"><AppSidebar onNavigate={() => setMobileOpen(false)} /></div>
    </SheetContent>
  </Sheet>;
}
