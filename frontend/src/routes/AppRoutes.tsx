import { Route, Routes } from 'react-router-dom';
import { APP_ROUTES, PUBLIC_ROUTES } from '../constants/routes';
import { AppLayout } from '../components/layout/AppLayout';
import { PublicLayout } from '../components/layout/PublicLayout';
import { WorkspaceAccessState } from '../components/layout/WorkspaceAccessState';

export function AppRoutes() {
  return <Routes>
    <Route element={<AppLayout />}>
      {APP_ROUTES.filter(route => route.path === '/').map(({ path, element }) => <Route key={path} path={path} element={element} />)}
      <Route element={<WorkspaceAccessState />}>
        {APP_ROUTES.filter(route => route.path !== '/').map(({ path, element }) => <Route key={path} path={path} element={element} />)}
      </Route>
    </Route>
    <Route element={<PublicLayout />}>
      {PUBLIC_ROUTES.map(({ path, element }) => <Route key={path} path={path} element={element} />)}
    </Route>
  </Routes>;
}
