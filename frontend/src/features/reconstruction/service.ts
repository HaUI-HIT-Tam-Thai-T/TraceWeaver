import { workspaceMutations } from '../../services/workspaceMutations';
import { apiClient } from "../../services/apiClient";
import { createReconstructionService } from "./createReconstructionService";

const raw = createReconstructionService(apiClient);
export const reconstructionService = {
  ...raw,
  createRun: (...args: Parameters<typeof raw.createRun>) => workspaceMutations.afterMutation(args[0], () => raw.createRun(...args)),
};
export const { createRun, getRun, getGraph } = reconstructionService;
