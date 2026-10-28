import { Outlet } from 'react-router-dom';

export function PublicLayout() {
  return <main id="main-content" className="mx-auto min-h-dvh max-w-2xl p-4 sm:p-8"><Outlet /></main>;
}
