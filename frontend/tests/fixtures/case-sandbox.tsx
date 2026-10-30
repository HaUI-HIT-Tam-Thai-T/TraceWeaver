// Synthetic in-memory sandbox only. No SSO, network API, or real UAT mutations.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SandboxPanel } from '../../src/features/case-sandbox/SandboxPanel';
import { CaseOverview } from '../../src/features/cases/components/CaseDetailView';
import { createCasesController } from '../../src/features/cases/state/controller';
import { initialCasesState } from '../../src/features/cases/state/state';
import { ApiError } from '../../src/services/apiError';
import { Button } from '../../src/components/ui/Button';
import { caseDetail, CID } from '../case-fixtures.mjs';
import { scope } from '../event-fixtures.mjs';
import { sandbox, attempt, proofs, proof } from '../sandbox-fixtures.mjs';
import '../../src/index.css';

let detail = caseDetail(), observed = sandbox(), history = proofs(), ram = 4;
detail.case.title = 'REQ-FIXTURE — Kiểm chứng nghiệp vụ mô phỏng'; detail.case.state = 'awaiting_verification'; detail.case.owner_id = 'user-a';
observed.observation.conditions.account_active = false;
const executions = new Map();
function reject(code = 'VERSION_CONFLICT') { return new ApiError({ kind: 'http', status: 409, code, message: 'Fixture version conflict' }); }
export function Fixture() {
  const [role, setRole] = useState('admin');
  const [controller] = useState(() => createCasesController({ listCases: async () => ({ items: [], next_cursor: null }), getCase: async () => structuredClone(detail) }, async () => {}, undefined, undefined, undefined, {
    getSandbox: async () => structuredClone(observed), getLab: async () => ({ version: observed.observation.source_version, ram }), getProofs: async () => structuredClone(history),
    command: async (_wid, _cid, body) => {
      if (body.expected_case_version !== detail.case.version) throw reject();
      if (body.action === 'provision' && executions.has(body.operation_id)) return { ...structuredClone(observed), execution: { replayed: true, operation_id: body.operation_id, attempt: executions.get(body.operation_id) } };
      if (body.expected_version !== observed.observation.source_version) throw reject();
      if (body.action === 'capacity') ram = body.ram;
      if (body.action === 'image') observed.observation.conditions.image_available = body.available;
      if (body.action === 'account') observed.observation.conditions.account_active = body.active;
      observed.observation.source_version++;
      if (body.action !== 'provision') { observed.observation.result = 'inconclusive'; observed.observation.reason = 'RERUN_REQUIRED'; return structuredClone(observed); }
      const conditions = observed.observation.conditions;
      const checks = [{ step: 'ram', passed: ram >= conditions.required_ram, reason: 'INSUFFICIENT_RAM' }, { step: 'image', passed: conditions.image_available, reason: 'IMAGE_UNAVAILABLE' }, { step: 'account', passed: conditions.account_active, reason: 'ACCOUNT_INACTIVE' }];
      const blockers = checks.filter(item => !item.passed).map(item => item.reason);
      const saved = attempt({ id: crypto.randomUUID(), operation_id: body.operation_id, number: observed.observation.attempts.length + 1, at: new Date().toISOString(), source_version: observed.observation.source_version, available_ram: ram, ...conditions, checks, blockers, reason: blockers[0] ?? null, result: blockers.length ? 'failed' : 'passed' });
      executions.set(body.operation_id, saved); observed.observation.attempts.push(saved); observed.observation.attempt = saved; observed.observation.result = saved.result; observed.observation.reason = saved.reason;
      observed.observation.delivery = { status: 'pending', total: 3, delivered: 0 };
      return { ...structuredClone(observed), execution: { replayed: false, operation_id: body.operation_id, attempt: saved } };
    },
    verify: async () => {
      const { attempts: _attempts, ...observation } = structuredClone(observed.observation);
      const saved = proof({ id: crypto.randomUUID(), case_version: detail.case.version, observation: observation.delivery.status === 'delivered' ? observation : { ...observation, result: 'inconclusive', reason: 'DELIVERY_PENDING' } });
      history.items.push(saved); return saved;
    },
  }));
  const [state, setState] = useState(initialCasesState);
  useEffect(() => { const stop = controller.subscribe(() => setState(controller.getSnapshot())); return stop; }, [controller]);
  useEffect(() => { controller.sync(role === 'logout' ? null : { ...scope(), canWrite: ['operator', 'reviewer', 'all'].includes(role), canVerify: ['reviewer', 'all'].includes(role), canAdmin: ['admin', 'all'].includes(role) }, { kind: 'detail', caseId: CID, search: '' }); return () => controller.stop(); }, [controller, role]);
  return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6"><h1 className="type-h1">Sandbox — dữ liệu kiểm thử trong bộ nhớ</h1>
    <div className="flex flex-wrap gap-4"><label>Vai trò fixture <select value={role} onChange={event => setRole(event.target.value)}>{['admin', 'operator', 'reviewer', 'viewer', 'all', 'logout'].map(value => <option key={value}>{value}</option>)}</select></label>
      <Button variant="tertiary" onClick={() => { observed.observation.delivery = { status: 'delivered', total: 3, delivered: 3 }; void controller.loadSandbox(); }}>Fixture: log đã chuyển</Button>
      <Button variant="tertiary" onClick={() => { detail.case.state = detail.case.state === 'closed' ? 'awaiting_verification' : 'closed'; detail.case.version++; observed.case_version = detail.case.version; history.case_version = detail.case.version; void controller.refresh(); }}>Fixture: đóng/mở hồ sơ</Button></div>
    {state.detail.data && <><CaseOverview item={state.detail.data.case} /><SandboxPanel state={state} actions={controller} /></>}
    {role === 'logout' && <p role="status">Đã gỡ dữ liệu của scope cũ.</p>}
  </main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture />);
