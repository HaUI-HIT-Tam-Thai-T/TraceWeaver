import { workspaceMutations } from "../../../services/workspaceMutations";
import { apiClient } from "../../../services/apiClient";
import { createReconstructionService } from "./createReconstructionService";
import type { ReconstructionService } from "./createReconstructionService";

const raw = createReconstructionService(apiClient);
export const reconstructionService: ReconstructionService = {
  ...raw,
  createRun: (workspaceId, body, options) =>
    workspaceMutations.afterMutation(workspaceId, () => raw.createRun(workspaceId, body, options)),
};
export const { createRun, getRun, getGraph } = reconstructionService;
