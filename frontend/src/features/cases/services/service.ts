import { workspaceMutations } from "../../../services/workspaceMutations";
import { apiClient } from "../../../services/apiClient";
import { createCasesService } from "./createCasesService";
import type { CasesService } from "./createCasesService";

const raw = createCasesService(apiClient);
export const casesService: CasesService = {
  ...raw,
  createCase: (workspaceId, body, options) =>
    workspaceMutations.afterMutation(workspaceId, () => raw.createCase(workspaceId, body, options)),
  addEvidence: (workspaceId, caseId, body, signal) =>
    workspaceMutations.afterMutation(workspaceId, () =>
      raw.addEvidence(workspaceId, caseId, body, signal),
    ),
  transitionCase: (workspaceId, caseId, body, options) =>
    workspaceMutations.afterMutation(workspaceId, () =>
      raw.transitionCase(workspaceId, caseId, body, options),
    ),
};
export const { createCase, listCases, getCase, addEvidence, transitionCase } = casesService;
