import { apiClient } from "../../services/apiClient";
import { createReconstructionService } from "./createReconstructionService";

export const reconstructionService = createReconstructionService(apiClient);
export const { createRun, getRun, getGraph } = reconstructionService;
