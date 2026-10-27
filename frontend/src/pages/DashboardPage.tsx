import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import { AuthStatus } from '../features/auth/AuthStatus';
import { useWorkspace } from '../features/workspace/workspaceContext';
import { WorkspacePanel } from '../features/workspace/WorkspacePanel';
import { createDashboardController, initialDashboardState } from '../features/dashboard/controller';
import type { DashboardScope } from '../features/dashboard/controller';
import { dashboardService } from '../features/dashboard/service';
import { readDashboardQuery, writeDashboardQuery } from '../features/dashboard/query';
import { DashboardCounters, DashboardTimeForm } from '../features/dashboard/DashboardView';
import { WaitingCaseList } from '../features/dashboard/WaitingCaseList';
import { workspaceMutations } from '../services/workspaceMutations';

export function DashboardPage() {
  const { state: auth } = useAuth();
  const { state: workspace, permissions } = useWorkspace();
  const me = workspace.me, wid = workspace.selectedWorkspaceId;
  const allowed = auth.status === 'authenticated' && workspace.status === 'ready' && permissions.canRead && me !== null && wid !== null;
  return <>
    <h1 className="mb-4 text-3xl font-bold">TraceWeaver — Dashboard</h1>
    <nav aria-label="Điều hướng dashboard" className="space-x-4"><Link to="/">Trang chủ</Link><Link to="/events">Event explorer</Link><Link to="/cases">Cases</Link></nav>
    <AuthStatus /><WorkspacePanel />
    <DashboardBrowser scope={allowed ? { subject: me.subject, workspaceId: wid, accessKey: me } : null} />
  </>;
}
function DashboardBrowser({ scope }: { scope: DashboardScope | null }) {
  const { refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const [controller] = useState(() => createDashboardController(dashboardService, refreshAccess));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => { controller.sync(scope, search); }, [controller, scope, search]);
  useEffect(() => workspaceMutations.subscribe(controller.invalidateWorkspace), [controller]);
  useEffect(() => () => controller.stop(), [controller]);
  const query = readDashboardQuery(search);
  const aligned = scope !== null && query.success && snapshot.scope?.accessKey === scope.accessKey && snapshot.scope.workspaceId === scope.workspaceId && JSON.stringify(snapshot.filters) === JSON.stringify(query.filters);
  const state = aligned ? snapshot : initialDashboardState();
  if (!scope) return <p>Đăng nhập và chọn workspace có quyền đọc để xem dashboard.</p>;
  return <>
    {!query.success && <p role="alert">Khoảng thời gian URL không hợp lệ. <Link to="/dashboard">Bắt đầu lại</Link></p>}
    <DashboardTimeForm key={JSON.stringify([scope.subject, scope.workspaceId, search])} filters={query.success ? query.filters : {}} apply={filters => {
      if (query.success && JSON.stringify(filters) === JSON.stringify(query.filters)) void controller.refresh();
      setParams(writeDashboardQuery(filters, query.success && query.waiting));
    }} />
    {query.success && <>
      <button type="button" disabled={['loading', 'reauth'].includes(state.status)} onClick={() => void controller.refresh()}>Làm mới dashboard</button>
      <div aria-live="polite">
        {state.status === 'loading' && <p role="status">Đang tải dashboard…</p>}
        {state.error && <p role="alert">{state.error.message} {state.error.requestId && <>Request ID: {state.error.requestId}</>}</p>}
        {state.status === 'reauth' ? <button type="button" onClick={() => void signIn()}>Đăng nhập lại</button> : state.error && <button type="button" onClick={() => void controller.refresh()}>Thử tải lại dashboard</button>}
      </div>
      {state.status === 'ready' && state.data && <>
        <DashboardCounters data={state.data} waiting={query.waiting} showWaiting={() => setParams(writeDashboardQuery(query.filters, !query.waiting))} />
        {query.waiting && <section id="waiting-cases" aria-label="Waiting cases">
          <h2 className="text-2xl font-semibold">Waiting cases</h2>
          <p>Hai query riêng new và assigned, cùng from/to theo run.created_at, 50 case mỗi trang và cursor độc lập. Dữ liệu live-state có thể thay đổi giữa hai query; số hàng tải về không phải tổng counter.</p>
          {(['new', 'assigned'] as const).map(caseState => <WaitingCaseList key={`${caseState}:${state.revision}`} scope={scope} filters={query.filters} caseState={caseState} deny={controller.accessDenied} />)}
        </section>}
      </>}
    </>}
  </>;
}
