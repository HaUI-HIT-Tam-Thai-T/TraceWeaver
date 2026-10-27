import { WorkflowForm } from '../features/cases/WorkflowForm';
import { Link, useLocation, useParams } from "react-router-dom";
import { useCases } from "../features/cases/casesContext";
import { CasesLayout } from "../features/cases/CasesLayout";
import { CasesFeedback } from "../features/cases/CasesFeedback";
import { CaseDetailView } from "../features/cases/CaseDetailView";
import { EvidenceForm } from '../features/cases/EvidenceForm';
import { useWorkspace } from '../features/workspace/workspaceContext';

export function CaseDetailPage() {
  const { state, refresh, loadEvidenceSnapshot, submitEvidence, beginNewEvidence, submitTransition, retryTransition, beginNewTransition } = useCases();
  const { permissions } = useWorkspace();
  const { caseId } = useParams();
  const location = useLocation();
  const workflowBusy = ['validating', 'sending'].includes(state.workflow.status);
  const matches = state.detail.id === caseId;
  return (
    <CasesLayout title="TraceWeaver — Chi tiết case">
      <Link className="my-4 block underline" to={`/cases${location.search}`}>
        Về danh sách với bộ lọc hiện tại
      </Link>
      <button
        type="button"
        disabled={
          state.status !== "active" || state.detail.status === "loading" || state.evidenceMutation.status === 'sending' || workflowBusy
        }
        onClick={refresh}
      >
        Làm mới chi tiết
      </button>
      <CasesFeedback />
      {state.status !== "invalid" &&
        state.status !== "blocked" &&
        state.status !== "reauth" &&
        (!matches || state.detail.status === "loading") && (
          <p role="status">Đang tải case/history/evidence…</p>
        )}
      {matches && state.detail.status === "ready" && state.detail.data && (
        <CaseDetailView detail={state.detail.data} />
      )}
      {matches && state.status === 'active' && state.detail.data && <EvidenceForm
        key={`evidence:${state.detail.data.case.id}:${state.detail.data.case.run_id}`}
        snapshot={state.snapshot} mutation={state.evidenceMutation}
        detailReady={state.detail.status === 'ready' && !workflowBusy && state.workflow.status !== 'uncertain'} closed={state.detail.data.case.state === 'closed'}
        canWrite={permissions.canWrite && state.scope?.canWrite === true}
        loadSnapshot={loadEvidenceSnapshot} submit={submitEvidence} beginNew={beginNewEvidence}
      />}
      {matches && state.status === 'active' && state.detail.data && state.scope && <WorkflowForm
        key={'workflow:' + state.detail.data.case.id + ':' + state.detail.data.case.run_id}
        detail={state.detail.data} scope={state.scope} ready={state.detail.status === 'ready' && state.evidenceMutation.status !== 'sending'}
        workflow={state.workflow} graph={state.workflowGraph} submit={submitTransition} retry={retryTransition} beginNew={beginNewTransition}
      />}
    </CasesLayout>
  );
}
