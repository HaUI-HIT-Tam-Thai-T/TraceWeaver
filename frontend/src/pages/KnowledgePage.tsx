import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/authContext";
import { AuthStatus } from "../features/auth/AuthStatus";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { WorkspacePanel } from "../features/workspace/WorkspacePanel";
import {
  createKnowledgeController,
  initialKnowledgeState,
} from "../features/knowledge/controller";
import type { KnowledgeScope } from "../features/knowledge/controller";
import { knowledgeService } from "../features/knowledge/service";
import {
  readKnowledgeQuery,
  writeKnowledgeQuery,
} from "../features/knowledge/query";
import {
  KnowledgeResults,
  KnowledgeSearchForm,
} from "../features/knowledge/KnowledgeView";

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
      <h1 className="mb-4 text-3xl font-bold">TraceWeaver — Knowledge</h1>
      <nav aria-label="Điều hướng knowledge" className="space-x-4">
        <Link to="/">Trang chủ</Link>
        <Link to="/events">Event explorer</Link>
        <Link to="/cases">Cases</Link>
      </nav>
      <AuthStatus />
      <WorkspacePanel />
      <KnowledgeBrowser
        scope={
          allowed
            ? { subject: me.subject, workspaceId: wid, accessKey: me }
            : null
        }
        search={params.toString()}
      />
    </>
  );
}
function KnowledgeBrowser({
  scope,
  search,
}: {
  scope: KnowledgeScope | null;
  search: string;
}) {
  const { refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const [controller] = useState(() =>
    createKnowledgeController(knowledgeService, refreshAccess),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
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
  if (!scope)
    return (
      <p>Đăng nhập và chọn workspace có quyền đọc để tra cứu knowledge.</p>
    );
  return (
    <>
      {!query.success && (
        <p role="alert">
          Bộ lọc URL không hợp lệ. <Link to="/knowledge">Bắt đầu lại</Link>
        </p>
      )}
      <KnowledgeSearchForm
        key={JSON.stringify([scope.subject, scope.workspaceId, search])}
        filters={query.success ? query.filters : { limit: 50 }}
        apply={(filters) => {
          const next = writeKnowledgeQuery(filters);
          if (
            next.toString() === params.toString() ||
            (query.success &&
              JSON.stringify(filters) === JSON.stringify(query.filters))
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
