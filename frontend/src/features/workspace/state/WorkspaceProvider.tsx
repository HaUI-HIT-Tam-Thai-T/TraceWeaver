import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { createWorkspaceController } from "./controller";
import { workspaceService } from "../workspaceService";
import { activeMembership, initialWorkspaceState, workspacePermissions } from "./state";
import { WorkspaceContext } from "./workspaceContext";

const hiddenState = initialWorkspaceState();

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const [controller] = useState(() => createWorkspaceController(workspaceService));
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);

    handleChange();
    return unsubscribe;
  }, [controller]);
  const authenticated = auth.status === "authenticated";

  useEffect(() => {
    if (!authenticated) {
      controller.stop();
      return;
    }
    void controller.start();
    const focus = () => {
      void controller.revalidateAccess();
    };
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("focus", focus);
      controller.stop();
    };
  }, [authenticated, controller]);

  const state = authenticated ? snapshot : hiddenState;
  const membership = activeMembership(state);
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        membership,
        permissions: workspacePermissions(membership),
        selectWorkspace: controller.selectWorkspace,
        refreshAccess: controller.refreshAccess,
        loadMoreSources: controller.loadMoreSources,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
