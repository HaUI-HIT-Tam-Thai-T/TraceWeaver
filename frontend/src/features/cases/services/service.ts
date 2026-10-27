import { workspaceMutations } from '../../../services/workspaceMutations';
import { apiClient } from "../../../services/apiClient";
import { createCasesService } from "./createCasesService";

const raw = createCasesService(apiClient);
export const casesService = {
  ...raw,
  createCase: (...args: Parameters<typeof raw.createCase>) => workspaceMutations.afterMutation(args[0], () => raw.createCase(...args)),
  addEvidence: (...args: Parameters<typeof raw.addEvidence>) => workspaceMutations.afterMutation(args[0], () => raw.addEvidence(...args)),
  transitionCase: (...args: Parameters<typeof raw.transitionCase>) => workspaceMutations.afterMutation(args[0], () => raw.transitionCase(...args)),
};
export const { createCase, listCases, getCase, addEvidence, transitionCase } = casesService;
