import { apiClient } from "../../services/apiClient";
import { createWorkspaceService } from "./createWorkspaceService";

export const workspaceService = createWorkspaceService(apiClient);
export const { getMe, listSources } = workspaceService;
