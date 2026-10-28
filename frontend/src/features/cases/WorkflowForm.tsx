import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CaseDetail } from './schemas';
import type { CasesState, CasesScope } from './state';
import { caseActionSchema, transitionSchema, transitionIssue, transitionStates } from './workflow';
import type { CaseTransition } from './workflow';

type Props = {
  detail: CaseDetail; scope: CasesScope; ready: boolean;
  workflow: CasesState['workflow']; graph: CasesState['workflowGraph'];
  submit: (body: CaseTransition) => Promise<void>; retry: () => Promise<void>; beginNew: () => void;
};
export function WorkflowForm(props: Props) {
  if (!props.scope.canWrite) return null;
  return <WorkflowEditor {...props} />;
}
function WorkflowEditor({ detail, scope, ready, workflow, graph, submit, retry, beginNew }: Props) {
  const first = caseActionSchema.options.find(action => transitionStates[action].from === detail.case.state) ?? 'assign';
  const { register, control, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<CaseTransition>({
    resolver: zodResolver(transitionSchema), defaultValues: { action: first, expected_version: detail.case.version, reason: '', ...(first === 'assign' ? { owner_id: scope.subject } : {}) },
    shouldUnregister: true,
  });
  const action = useWatch({ control, name: 'action' });
  const reason = useWatch({ control, name: 'reason' });
  const expected = useWatch({ control, name: 'expected_version' });
  const busy = !ready || isSubmitting || ['validating', 'sending'].includes(workflow.status);
  const issue = transitionIssue(detail, scope, action, reason);
  const frozen = workflow.attempt !== null || workflow.status === 'conflict';
  return <section className="my-6 space-y-3" aria-labelledby="workflow-title">
    <h2 id="workflow-title">Chuyển trạng thái case</h2>
    <p>BE kiểm lại owner, membership và grants. Owner dùng subject, không dùng username.</p>
    <p>Case.version đã chọn: {expected}; hiện tại: {detail.case.version}.</p>
    <form onSubmit={handleSubmit(values => submit(values))} className="space-y-3">
      <fieldset disabled={busy || frozen} className="space-y-3">
        <label className="block">Action <select {...register('action')}>
          {caseActionSchema.options.map(value => <option key={value} value={value} disabled={transitionStates[value].from !== detail.case.state || (['verify_close', 'verification_failed', 'reopen'].includes(value) && !scope.canVerify)}>{value}</option>)}
        </select></label>
        <input type="hidden" {...register('expected_version', { valueAsNumber: true })} />
        {errors.expected_version && <p role="alert">Version không hợp lệ; chọn lại version hiện tại.</p>}
        {errors.action && <p role="alert">Chọn action hợp lệ.</p>}
        {action === 'assign' && <div><label>Owner subject <input {...register('owner_id')} aria-invalid={!!errors.owner_id} /></label>
          <button type="button" onClick={() => setValue('owner_id', scope.subject)}>Giao cho tôi</button>
          {errors.owner_id && <p role="alert">{errors.owner_id.message}</p>}</div>}
        <label className="block">Reason <textarea {...register('reason')} maxLength={1000} aria-invalid={!!errors.reason} aria-describedby="workflow-reason-error" /></label>
        {errors.reason && <p id="workflow-reason-error" role="alert">{errors.reason.message}</p>}
        {issue && <p role="status">{issue}</p>}
        <button type="submit" disabled={!!issue}>Gửi transition</button>
      </fieldset>
    </form>
    {workflow.status === 'validating' && <p role="status">Đang kiểm tra detail và điều kiện hiện tại…</p>}
    {workflow.status === 'sending' && <p role="status">Đang gửi transition…</p>}
    {workflow.status === 'success' && <p role="status">Đã ghi transition. {ready ? 'Detail đã đồng bộ từ BE.' : 'Chưa đồng bộ detail; hãy tải lại, không gửi POST lại.'}</p>}
    {workflow.error && <p role="alert">{workflow.error.code}: {workflow.error.message}</p>}
    {action === 'verify_close' && <p>Kiểm pending links của toàn run trước khi gửi: {graph.pendingCount ?? 'sẽ tải graph mới'}.</p>}
    {workflow.status === 'uncertain' && <><p>Kết quả chưa rõ. Gửi lại giữ nguyên body/key trong 24 giờ; thao tác mới có thể ghi thêm transition.</p><button type="button" disabled={busy || workflow.error?.code === 'IDEMPOTENCY_EXPIRED'} onClick={() => void retry()}>Gửi lại thao tác</button></>}
    {(workflow.attempt || workflow.status === 'conflict') && <button type="button" disabled={busy} onClick={() => {
      beginNew(); setValue('expected_version', detail.case.version);
      if (workflow.status === 'success') { setValue('action', first); setValue('reason', ''); }
      if (getValues('action') !== 'assign') setValue('owner_id', undefined);
    }}>{workflow.status === 'conflict' ? 'Dùng Case.version hiện tại' : 'Bắt đầu thao tác mới với version hiện tại'}</button>}
    <p>Hủy chờ ở FE không chứng minh BE đã rollback.</p>
  </section>;
}
