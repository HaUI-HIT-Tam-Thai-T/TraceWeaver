import { apiClient } from "../../services/apiClient";
import { createCasesService } from "./createCasesService";

export const casesService = createCasesService(apiClient);
export const { createCase, listCases, getCase, addEvidence, transitionCase } = casesService;
