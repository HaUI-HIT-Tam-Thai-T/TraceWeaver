import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "../components/ui/primitives/breadcrumb";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { WorkflowForm } from "../features/cases/components/WorkflowForm";
import { Link, useLocation, useParams } from "react-router-dom";
import { useCases } from "../features/cases/hooks/useCases";
import { CasesLayout } from "../features/cases/components/CasesLayout";
import { CasesFeedback } from "../features/cases/components/CasesFeedback";
import { CaseDetailView } from "../features/cases/components/CaseDetailView";
import { EvidenceForm } from "../features/cases/components/EvidenceForm";
import { useWorkspace } from "../features/workspace/hooks/useWorkspace";

export function CaseDetailPage() {
  const {
    state,
    refresh,
    loadEvidenceSnapshot,
    submitEvidence,
    beginNewEvidence,
    submitTransition,
    retryTransition,
    beginNewTransition,
  } = useCases();
  const { permissions } = useWorkspace();
  const { caseId } = useParams();
  const location = useLocation();
  const workflowBusy = ["validating", "sending"].includes(
    state.workflow.status,
  );
  const showTools = permissions.canWrite && state.scope?.canWrite === true;
  const matches = state.detail.id === caseId;
  return (
    <CasesLayout title="Chi tiết hồ sơ">
      <Breadcrumb aria-label="Vị trí hồ sơ">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/cases${location.search}`}>
                Hồ sơ — bộ lọc hiện tại
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Chi tiết hồ sơ</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Button
        variant="secondary"
        type="button"
        disabled={
          state.status !== "active" ||
          state.detail.status === "loading" ||
          state.evidenceMutation.status === "sending" ||
          workflowBusy
        }
        onClick={refresh}
      >
        Làm mới chi tiết
      </Button>
      <CasesFeedback />
      {state.status !== "invalid" &&
        state.status !== "blocked" &&
        state.status !== "reauth" &&
        (!matches || state.detail.status === "loading") && (
          <LoadingState message="Đang tải hồ sơ, lịch sử và bằng chứng…" />
        )}
      <div className={showTools ? "detail-workspace" : "min-w-0"}>
        <div className="min-w-0">
          {matches && state.detail.status === "ready" && state.detail.data && (
            <CaseDetailView
              key={state.detail.data.case.id + state.detail.data.case.run_id}
              detail={state.detail.data}
            />
          )}
        </div>
        {showTools && (
          <aside className="case-tools" aria-label="Thao tác hồ sơ">
            {matches && state.status === "active" && state.detail.data && (
              <EvidenceForm
                key={`evidence:${state.detail.data.case.id}:${state.detail.data.case.run_id}`}
                snapshot={state.snapshot}
                mutation={state.evidenceMutation}
                detailReady={
                  state.detail.status === "ready" &&
                  !workflowBusy &&
                  state.workflow.status !== "uncertain"
                }
                closed={state.detail.data.case.state === "closed"}
                canWrite={
                  permissions.canWrite && state.scope?.canWrite === true
                }
                loadSnapshot={loadEvidenceSnapshot}
                submit={submitEvidence}
                beginNew={beginNewEvidence}
              />
            )}
            {matches &&
              state.status === "active" &&
              state.detail.data &&
              state.scope && (
                <WorkflowForm
                  key={
                    "workflow:" +
                    state.detail.data.case.id +
                    ":" +
                    state.detail.data.case.run_id
                  }
                  detail={state.detail.data}
                  scope={state.scope}
                  ready={
                    state.detail.status === "ready" &&
                    state.evidenceMutation.status !== "sending"
                  }
                  workflow={state.workflow}
                  graph={state.workflowGraph}
                  submit={submitTransition}
                  retry={retryTransition}
                  beginNew={beginNewTransition}
                />
              )}
          </aside>
        )}
      </div>
    </CasesLayout>
  );
}
