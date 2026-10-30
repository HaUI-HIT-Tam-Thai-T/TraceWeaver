import { createContext } from "react";
import type { WorkspaceController } from "./controller";
import type { Membership } from "../schemas";
import type { WorkspaceState, WorkspacePermissions } from "./state";

export type WorkspaceContextValue = Pick<
  WorkspaceController,
  "selectWorkspace" | "refreshAccess" | "loadMoreSources"
> & {
  state: WorkspaceState;
  membership: Membership | null;
  permissions: WorkspacePermissions;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
