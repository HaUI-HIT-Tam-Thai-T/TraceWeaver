// Isolated fixture: synthetic data only; no SSO/API calls.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { createAdminController, initialAdminState } from '../../src/features/workspace-admin/controller';
import { WorkspaceAdminView } from '../../src/features/workspace-admin/components/WorkspaceAdminView';
import { page, member, scope, completed, SID, WID } from '../admin-fixtures.mjs';
import '../../src/index.css';
let current = page(), accountCalls = 0;
current.items.push({ ...member('fixture-member-with-a-long-subject-for-mobile-testing-0123456789'), roles: ['viewer'] });
export function Fixture() {
  const [role, setRole] = useState('admin');
  const [params, setParams] = useSearchParams();
  const [controller] = useState(() => createAdminController({
    list: async () => structuredClone(current),
    add: async (_wid, body) => { current.items.push({ ...body, active: true, direct_source_ids: [] }); current.version++; return { subject: body.subject, roles: body.roles, active: true, version: current.version }; },
    update: async (_wid, subject, body) => { const item = current.items.find(value => value.subject === subject); if (item) { item.roles = body.roles; item.active = body.active; } current.version++; return { subject, ...body, version: current.version }; },
    grant: async (_wid, subject, sid, body) => { const item = current.items.find(value => value.subject === subject); if (item) item.direct_source_ids = body.enabled ? [sid] : []; current.version++; return { subject, source_id: sid, enabled: body.enabled, version: current.version }; },
    createAccount: async (_wid, body) => { accountCalls++; if (accountCalls === 1) { const { ApiError } = await import('../../src/services/apiError'); throw new ApiError({ kind: 'http', status: 503, code: 'ACCOUNT_PROVISIONING_PENDING', message: 'Synthetic pending' }); } current.version++; return { ...completed(current.version), username: body.username, roles: body.roles }; },
    operation: async () => ({ state: 'pending', username: 'fixture.new-user', current_version: current.version }),
  }, async () => {}));
  const [state, setState] = useState(initialAdminState);
  useEffect(() => controller.subscribe(() => setState(controller.getSnapshot())), [controller]);
  useEffect(() => { controller.sync(role === 'admin' ? scope() : null); return () => controller.stop(); }, [controller, role]);
  const tab = params.get('tab') === 'accounts' ? 'accounts' : 'members';
  return <main className="mx-auto max-w-6xl space-y-5 p-5"><h1 className="type-h1">Quản trị workspace — fixture</h1>
    <label>Vai trò fixture <select value={role} onChange={event => setRole(event.target.value)}><option value="admin">Quản trị viên</option><option value="reviewer">Người xác minh</option><option value="logout">Đăng xuất</option></select></label>
    {state.scope && <WorkspaceAdminView key={state.epoch} state={state} controller={controller} sources={[{ id: SID, workspace_id: WID, name: 'Nguồn tiếp nhận yêu cầu', service: 'intake', parser_version: 'v1' }]} sourcesReady tab={tab} changeTab={value => setParams({ tab: value })} />}
    {role !== 'admin' && <p role="status">Không có quyền quản trị. Dữ liệu và intent đã xóa.</p>}
  </main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<BrowserRouter><Fixture /></BrowserRouter>);
