import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import { PageHeading } from "../components/layout/PageHeading";
import { createWorkspaceAdminService } from "../features/workspace/admin/workspaceAdminService";
import { apiClient } from "../services/apiClient";
import { createAdminController, initialAdminState } from "../features/workspace/admin/controller";
import { WorkspaceAdminView } from "../features/workspace/admin/components/WorkspaceAdminView";

const service = createWorkspaceAdminService(apiClient);
export function WorkspaceAdminPage() {
  const { state: auth } = useAuth();
  const { state: workspace, membership, permissions, refreshAccess } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "accounts" ? "accounts" : "members";
  const [controller] = useState(() => createAdminController(service, refreshAccess));
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);
  const me = workspace.me,
    wid = membership?.workspace_id;
  const ids = workspace.sources.items
    .map((source) => source.id)
    .sort()
    .join(",");
  const allowed =
    auth.status === "authenticated" &&
    workspace.status === "ready" &&
    permissions.canAdmin &&
    me !== null &&
    wid !== undefined;
  useEffect(() => {
    function changed() {
      setSnapshot(controller.getSnapshot());
    }
    const stop = controller.subscribe(changed);
    changed();
    return stop;
  }, [controller]);
  useEffect(() => {
    controller.sync(
      allowed && me && wid
        ? { subject: me.subject, wid, accessKey: me, sourceIds: ids ? ids.split(",") : [] }
        : null,
    );
  }, [controller, allowed, me, wid, ids]);
  useEffect(() => () => controller.stop(), [controller]);
  const aligned =
    allowed &&
    snapshot.scope?.accessKey === me &&
    snapshot.scope?.wid === wid &&
    snapshot.scope?.sourceIds.join() === ids;
  const state = aligned ? snapshot : initialAdminState();
  return (
    <div className="space-y-5">
      <PageHeading title="Quản trị workspace" />
      {aligned && (
        <WorkspaceAdminView
          key={state.epoch}
          state={state}
          controller={controller}
          sources={workspace.sources.items}
          sourcesReady={workspace.sources.status === "ready"}
          tab={tab}
          changeTab={(value) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              if (value === "members") next.delete("tab");
              else next.set("tab", "accounts");
              return next;
            })
          }
        />
      )}
    </div>
  );
}
