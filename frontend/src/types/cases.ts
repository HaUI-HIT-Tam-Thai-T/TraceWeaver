import type { z } from "zod";
import type {
  caseAssigneesSchema,
  evidenceCreateSchema,
  caseSchema,
  historySchema,
  evidenceSchema,
  caseCreateSchema,
  caseDetailSchema,
  caseFiltersSchema,
  casesPageSchema,
} from "../features/cases/schemas.ts";

export type CaseAssignees = z.infer<typeof caseAssigneesSchema>;
export type EvidenceCreate = z.infer<typeof evidenceCreateSchema>;
export type Case = z.infer<typeof caseSchema>;
export type WorkflowHistory = z.infer<typeof historySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CaseCreate = z.infer<typeof caseCreateSchema>;
export type CaseDetail = z.infer<typeof caseDetailSchema>;
export type CaseFilters = z.infer<typeof caseFiltersSchema>;
export type CasesPage = z.infer<typeof casesPageSchema>;
