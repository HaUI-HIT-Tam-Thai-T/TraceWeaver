import { PageHeading } from "../components/layout/PageHeading";
import { Alert } from "../components/ui/primitives/alert";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  createKnowledgeController,
  initialKnowledgeState,
} from "../features/knowledge/state/controller";
import type { KnowledgeScope } from "../features/knowledge/state/controller";
import { knowledgeService } from "../features/knowledge/knowledgeService";
import { readKnowledgeQuery, writeKnowledgeQuery } from "../features/knowledge/query";
import {
  KnowledgeResults,
  KnowledgeSearchForm,
} from "../features/knowledge/components/KnowledgeView";

export function KnowledgePage() {
  const { state: auth } = useAuth();
  const { state: workspace, permissions } = useWorkspace();
  const [params] = useSearchParams();
  const me = workspace.me;
  const wid = workspace.selectedWorkspaceId;
  const allowed =
    auth.status === "authenticated" &&
    workspace.status === "ready" &&
    permissions.canRead &&
    me !== null &&
    wid !== null;
  return (
    <>
      <PageHeading title="Tri thức" />
      <KnowledgeBrowser
        scope={allowed ? { subject: me.subject, workspaceId: wid, accessKey: me } : null}
        search={params.toString()}
      />
    </>
  );
}
function KnowledgeBrowser({ scope, search }: { scope: KnowledgeScope | null; search: string }) {
  const { refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const [controller] = useState(() => createKnowledgeController(knowledgeService, refreshAccess));
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);

    handleChange();
    return unsubscribe;
  }, [controller]);
  useEffect(() => {
    controller.sync(scope, search);
  }, [controller, scope, search]);
  useEffect(() => () => controller.stop(), [controller]);
  const query = readKnowledgeQuery(search);
  const aligned =
    query.success &&
    JSON.stringify(snapshot.filters) === JSON.stringify(query.filters) &&
    scope !== null &&
    snapshot.scope?.accessKey === scope.accessKey &&
    snapshot.scope.workspaceId === scope.workspaceId;
  const state = aligned ? snapshot : initialKnowledgeState();
  if (!scope) return <p>Đăng nhập và chọn workspace có quyền đọc để tra cứu knowledge.</p>;
  return (
    <>
      {!query.success && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Bộ lọc URL không hợp lệ. <Link to="/knowledge">Bắt đầu lại</Link>
        </Alert>
      )}
      <KnowledgeSearchForm
        key={JSON.stringify([scope.subject, scope.workspaceId, search])}
        filters={query.success ? query.filters : { limit: 50 }}
        apply={(filters) => {
          const next = writeKnowledgeQuery(filters);
          if (
            next.toString() === params.toString() ||
            (query.success && JSON.stringify(filters) === JSON.stringify(query.filters))
          )
            void controller.refresh();
          setParams(next);
        }}
      />
      {query.success && (
        <KnowledgeResults
          state={state}
          refresh={() => {
            void controller.refresh();
          }}
          previous={() => {
            void controller.previousPage();
          }}
          next={() => {
            void controller.nextPage();
          }}
          signIn={() => {
            void signIn();
          }}
        />
      )}
    </>
  );
}
