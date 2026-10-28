import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { casesService } from "../services/service";
import { createCasesController } from "./controller";
import { CasesContext } from "./casesContext";
import { initialCasesState } from "./state";
import { readCaseQuery, writeCaseQuery } from "../query";
import { reconstructionService } from '../../reconstruction/services/service';

const hiddenState = initialCasesState();
export function CasesProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const {
    state: workspace,
    membership,
    permissions,
    refreshAccess,
  } = useWorkspace();
  const [controller] = useState(() =>
    createCasesController(casesService, refreshAccess, { addEvidence: casesService.addEvidence, getGraph: reconstructionService.getGraph }, { transitionCase: casesService.transitionCase }),
  );
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
  const location = useLocation();
  const navigate = useNavigate();
  const lastScope = useRef<string | null>(null);
  const me = workspace.me;
  const wid = membership?.workspace_id;
  const allowed =
    auth.status === "authenticated" &&
    workspace.status === "ready" &&
    permissions.canRead &&
    me !== null &&
    wid !== undefined;
  const detailId = matchPath("/cases/:caseId", location.pathname)?.params
    .caseId;
  const isList = location.pathname === "/cases";
  const isCases = isList || detailId !== undefined;
  useEffect(() => {
    if (auth.status !== "authenticated") {
      controller.stop();
      lastScope.current = null;
      if (isCases && (detailId || location.search))
        navigate("/cases", { replace: true });
      return;
    }
    const view = detailId
      ? { kind: "detail" as const, caseId: detailId, search: location.search }
      : isList
        ? { kind: "list" as const, search: location.search }
        : { kind: "none" as const };
    if (!allowed || !me || !wid) {
      controller.sync(null, view);
      return;
    }
    const key = JSON.stringify([me.subject, wid]);
    const changed = lastScope.current !== null && lastScope.current !== key;
    lastScope.current = key;
    const scope = { subject: me.subject, workspaceId: wid, accessKey: me, canWrite: permissions.canWrite, canVerify: permissions.canVerify };
    if (changed && isCases) {
      controller.sync(scope, { kind: "list", search: "" });
      navigate("/cases", { replace: true });
    } else controller.sync(scope, view);
  }, [
    auth.status,
    allowed,
    permissions.canWrite,
    permissions.canVerify,
    me,
    wid,
    detailId,
    isList,
    isCases,
    location.search,
    controller,
    navigate,
  ]);
  useEffect(() => () => controller.stop(), [controller]);
  const query = readCaseQuery(location.search);
  const aligned = !isCases || (query.success ? JSON.stringify(snapshot.filters) === JSON.stringify(query.filters) : snapshot.status === 'invalid');
  const state =
    allowed &&
    aligned &&
    snapshot.scope?.accessKey === me &&
    snapshot.scope.workspaceId === wid && snapshot.scope.canWrite === permissions.canWrite && snapshot.scope.canVerify === permissions.canVerify
      ? snapshot
      : hiddenState;
  return (
    <CasesContext.Provider
      value={{
        state,
        setFilters(filters) {
          const params = writeCaseQuery(filters);
          if (state.scope) {
            if (JSON.stringify(filters) === JSON.stringify(state.filters) && state.status !== 'invalid') void controller.refresh();
            else controller.sync(state.scope, { kind: 'list', search: `?${params}` });
          }
          navigate(`/cases?${params}`);
        },
        refresh() {
          void controller.refresh();
        },
        previousPage() {
          void controller.previousPage();
        },
        nextPage() {
          void controller.nextPage();
        },
        loadEvidenceSnapshot: controller.loadEvidenceSnapshot,
        submitEvidence: controller.submitEvidence,
        beginNewEvidence: controller.beginNewEvidence,
        submitTransition: controller.submitTransition,
        retryTransition: controller.retryTransition,
        beginNewTransition: controller.beginNewTransition,
      }}
    >
      {children}
    </CasesContext.Provider>
  );
}
