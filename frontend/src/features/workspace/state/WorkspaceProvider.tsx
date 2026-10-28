import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { createWorkspaceController } from "./controller";
import { workspaceService } from "../services/service";
import {
  activeMembership,
  initialWorkspaceState,
  workspacePermissions,
} from "./state";
import { WorkspaceContext } from "./workspaceContext";

const hiddenState = initialWorkspaceState();

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const [controller] = useState(() =>
    createWorkspaceController(workspaceService),
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
  const authenticated = auth.status === "authenticated";

  useEffect(() => {
    if (!authenticated) {
      controller.stop();
      return;
    }
    void controller.start();
    const focus = () => {
      void controller.refreshAccess();
    };
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("focus", focus);
      controller.stop();
    };
  }, [authenticated, controller]);

  // Hide the old scope in the same render as logout, before effect cleanup runs.
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
