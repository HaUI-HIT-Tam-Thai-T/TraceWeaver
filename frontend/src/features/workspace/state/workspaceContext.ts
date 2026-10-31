import { createContext } from "react";
import type { WorkspaceController } from "./controller";
import type { Membership, WorkspacePermissions } from "../../../types/workspace";
import type { WorkspaceState } from "./state";

export type WorkspaceContextValue = Pick<
  WorkspaceController,
  "selectWorkspace" | "refreshAccess" | "loadMoreSources"
> & {
  state: WorkspaceState;
  membership: Membership | null;
  permissions: WorkspacePermissions;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
