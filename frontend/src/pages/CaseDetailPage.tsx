import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "../components/ui/primitives/breadcrumb";
import { CaseRunPanel } from '../features/cases/components/CaseRunPanel';
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { WorkflowForm } from "../features/cases/components/WorkflowForm";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useCases } from "../features/cases/hooks/useCases";
import { CasesLayout } from "../features/cases/components/CasesLayout";
import { CasesFeedback } from "../features/cases/components/CasesFeedback";
import { CaseDetailView, CaseOverview } from "../features/cases/components/CaseDetailView";
import { useEffect, useState } from 'react';
import { EvidenceForm } from "../features/cases/components/EvidenceForm";
import { useWorkspace } from "../features/workspace/hooks/useWorkspace";

export function CaseDetailPage() {
  const {
    state,
    loadCaseRun, loadCaseAssignees, reviewCaseLink, createCaseManualLink,
    refresh,
    loadEvidenceSnapshot,
    submitEvidence,
    beginNewEvidence,
    submitTransition,
    retryTransition,
    beginNewTransition,
  } = useCases();
  const { permissions, state: workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const selectedTab = ["evidence", "reconstruction"].includes(params.get("tab") ?? "") ? params.get("tab") ?? "history" : "history";
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1536px)');
    function updateTools() { setToolsOpen(wide.matches && selectedTab !== 'reconstruction'); }
    updateTools(); wide.addEventListener('change', updateTools);
    return () => wide.removeEventListener('change', updateTools);
  }, [selectedTab]);
  const { caseId } = useParams();
  const location = useLocation();
  const workflowBusy = ["validating", "sending"].includes(
    state.workflow.status,
  ) || state.linkMutation.status === 'sending' || state.snapshot.status === 'loading' || state.caseRun.status === 'loading';
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
      <div className="flex flex-wrap gap-3 py-3"><Button
        variant="tertiary"
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
      {showTools && matches && state.detail.data && <Button type="button" variant="tertiary" aria-controls="case-tools" aria-expanded={toolsOpen} onClick={() => setToolsOpen(value => !value)}>{toolsOpen ? 'Thu gọn tác vụ hồ sơ' : 'Mở tác vụ hồ sơ'}</Button>}
      </div>
      <CasesFeedback />
      {state.status !== "invalid" &&
        state.status !== "blocked" &&
        state.status !== "reauth" &&
        (!matches || state.detail.status === "loading") && (
          <LoadingState message="Đang tải hồ sơ, lịch sử và bằng chứng…" />
        )}
      {matches && state.detail.status === 'ready' && state.detail.data && <div className="my-5"><CaseOverview item={state.detail.data.case} /></div>}
      <div className={showTools ? "detail-workspace" : "min-w-0"} data-tools-open={showTools && toolsOpen} data-wide={selectedTab === 'reconstruction'}>
        <div className="min-w-0">
          {matches && state.detail.status === "ready" && state.detail.data && (
            <CaseDetailView
              key={state.detail.data.case.id + state.detail.data.case.run_id}
              detail={state.detail.data}
              showOverview={false}
              selectedTab={selectedTab}
              onTabChange={tab => { setParams(previous => { const next = new URLSearchParams(previous); if (tab === 'history') next.delete('tab'); else next.set('tab', tab); return next; }); }}
              snapshot={state.snapshot} loadSnapshot={loadEvidenceSnapshot} sources={workspace.sources.items}
              runPanel={<CaseRunPanel state={state} active={selectedTab === 'reconstruction'} load={loadCaseRun} actions={{ reviewLink: reviewCaseLink, createManualLink: createCaseManualLink, probeClosedCase: refresh }} />}
            />
          )}
        </div>
        {showTools && (
          <aside id="case-tools" className="case-tools" hidden={!toolsOpen} aria-label="Thao tác hồ sơ">
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
                  assignees={state.assignees}
                  loadAssignees={loadCaseAssignees}
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
