import { useContext } from "react";
import { WorkspaceContext } from "../state/workspaceContext";

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
