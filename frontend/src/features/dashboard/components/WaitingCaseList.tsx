import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCasesController } from '../../cases/state/controller';
import { initialCasesState } from '../../cases/state/state';
import { writeCaseQuery } from '../../cases/query';
import { casesService } from '../../cases/services/service';
import type { DashboardFilters } from '../schemas';
import type { DashboardScope } from '../state/controller';
import type { ApiError } from '../../../services/apiError';
import { waitingCaseQuery } from '../query';

export function WaitingCaseList({ scope, filters, caseState, deny }: {
  scope: DashboardScope; filters: DashboardFilters; caseState: 'new' | 'assigned'; deny: (error: ApiError) => void;
}) {
  const [controller] = useState(() => createCasesController(casesService, async () => undefined));
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);
  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);
    // Catch a change between rendering and registering the listener.
    handleChange();
    return unsubscribe;
  }, [controller]);
  const search = waitingCaseQuery(filters, caseState);
  useEffect(() => { controller.sync(scope, { kind: 'list', search }); }, [controller, scope, search]);
  useEffect(() => () => controller.stop(), [controller]);
  const aligned = snapshot.scope?.accessKey === scope.accessKey && snapshot.scope.workspaceId === scope.workspaceId && snapshot.filters.state === caseState && snapshot.filters.from === filters.from && snapshot.filters.to === filters.to;
  const state = aligned ? snapshot : initialCasesState();
  useEffect(() => { if (aligned && ['blocked', 'reauth'].includes(snapshot.status) && snapshot.error) deny(snapshot.error); }, [aligned, snapshot.status, snapshot.error, deny]);
  const ready = state.list.status === 'ready' && state.status === 'active';
  const error = state.error ?? state.list.error;
  return <section aria-label={`Waiting cases ${caseState}`} className="my-6 space-y-3">
    <h3 className="text-xl font-semibold">Cases {caseState}</h3>
    {state.list.status === 'loading' && <p role="status">Đang tải cases {caseState}…</p>}
    {error && <p role="alert">{error.message} {error.requestId && <>Request ID: {error.requestId}</>}</p>}
    {error && state.status === 'active' && <button type="button" onClick={() => void controller.refresh()}>{error.code === 'INVALID_CURSOR' ? 'Bắt đầu lại từ trang đầu' : 'Thử tải lại'}</button>}
    {ready && state.list.items.length === 0 && <p>Không có case {caseState} trong trang này.</p>}
    {ready && <ul>{state.list.items.map(item => <li key={item.id} className="my-2">
      <Link className="underline" to={`/cases/${item.id}?${writeCaseQuery(state.filters)}`}>{item.title}</Link>
      <p>State: {item.state} · Case.version: {item.version} · Owner: {item.owner_id ?? 'Chưa được gán'}</p>
    </li>)}</ul>}
    <nav aria-label={`Phân trang cases ${caseState}`} className="space-x-4">
      <button type="button" disabled={!ready || state.index === 0} onClick={() => void controller.previousPage()}>Trước</button>
      <span>Trang {state.index + 1}</span>
      <button type="button" disabled={!ready || !state.nextCursor} onClick={() => void controller.nextPage()}>Tiếp</button>
    </nav>
  </section>;
}
