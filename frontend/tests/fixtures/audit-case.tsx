// Isolated browser fixture. No Keycloak, source system or production requests.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { CaseDetailView } from "../../src/features/cases/components/CaseDetailView";
import { CaseRunPanel } from "../../src/features/cases/components/CaseRunPanel";
import { WorkflowForm } from '../../src/features/cases/components/WorkflowForm';
import { transitionStates } from '../../src/features/cases/workflow';
import { createCasesController } from "../../src/features/cases/state/controller";
import { initialCasesState } from "../../src/features/cases/state/state";
import { caseDetail, CID } from "../case-fixtures.mjs";
import { graph, run } from "../reconstruction-fixtures.mjs";
import { scope, EID } from "../event-fixtures.mjs";
import "../../src/index.css";
const detail = caseDetail();
detail.case.title = "REQ-02 — Điều tra cấp môi trường thất bại";
detail.evidence[0].kind = "events";
detail.evidence[0].event_ids = [EID];
const sourceGraph = graph();
sourceGraph.nodes[0].message = "Yêu cầu đã tiếp nhận";
export function Fixture() {
  const [params, setParams] = useSearchParams();
  const [role, setRole] = useState("reviewer");
  const [controller] = useState(() =>
    createCasesController(
      {
        listCases: async () => ({ items: [], next_cursor: null }),
        getCase: async () => structuredClone(detail),
      },
      async () => {},
      {
        addEvidence: async () => {
          throw Error("Fixture read only");
        },
        getGraph: async () => structuredClone(sourceGraph),
      },
      {
        listAssignees: async () => ({ items: [
          { subject: scope().subject, roles: ['reviewer'] },
          { subject: 'opaque/idp|subject:123', roles: ['operator'] },
        ] }),
        transitionCase: async (_wid, _cid, body) => {
          detail.case.state = transitionStates[body.action].to;
          detail.case.version++;
          if (body.action === 'assign') detail.case.owner_id = body.owner_id;
          return structuredClone(detail.case);
        },
      },
      {
        getRun: async () => run("completed"),
        reviewLink: async () => {
          sourceGraph.links[0].review_state = "accepted";
          sourceGraph.links[0].version++;
        },
        createManualLink: async () => {
          throw Error("Fixture read only");
        },
      },
    ),
  );
  const [state, setState] = useState(initialCasesState);
  useEffect(
    () => controller.subscribe(() => setState(controller.getSnapshot())),
    [controller],
  );
  useEffect(() => {
    if (role === "logout") controller.stop();
    else
      controller.sync(
        {
          ...scope(),
          accessKey: {},
          canWrite: role === "reviewer",
          canVerify: role === "reviewer",
        },
        { kind: "detail", caseId: CID, search: "" },
      );
    return () => controller.stop();
  }, [controller, role]);
  const tab = params.get("tab") ?? "history";
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5">
      <h1 className="type-h1">Kiểm tra hồ sơ</h1>
      <label>
        Vai trò fixture{" "}
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="reviewer">Người xác minh</option>
          <option value="viewer">Người xem</option>
          <option value="logout">Đăng xuất fixture</option>
        </select>
      </label>
      {state.detail.data && (
        <CaseDetailView
          detail={state.detail.data}
          selectedTab={tab}
          onTabChange={(value) => setParams({ tab: value })}
          sources={[]}
          snapshot={state.snapshot}
          loadSnapshot={controller.loadEvidenceSnapshot}
          runPanel={
            <CaseRunPanel
              state={state}
              active={tab === "reconstruction"}
              load={controller.loadCaseRun}
              actions={{
                reviewLink: controller.reviewCaseLink,
                createManualLink: controller.createCaseManualLink,
                probeClosedCase: controller.refresh,
              }}
            />
          }
        />
      )}
      {state.detail.data && state.scope && <WorkflowForm key={`${role}:${state.detail.data.case.id}`}
        detail={state.detail.data} scope={state.scope} ready={state.detail.status === 'ready'}
        workflow={state.workflow} graph={state.workflowGraph} assignees={state.assignees}
        loadAssignees={controller.loadCaseAssignees} submit={controller.submitTransition}
        retry={controller.retryTransition} beginNew={controller.beginNewTransition} />}
    </main>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <BrowserRouter>
      <Fixture />
    </BrowserRouter>,
  );
