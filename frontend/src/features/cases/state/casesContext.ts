import type { CaseTransition } from '../workflow';
import { createContext } from "react";
import type { CasesState } from "./state";
import type { CaseFilters } from "../schemas";
import type { EvidenceCreate } from '../schemas';

export type CasesContextValue = {
  state: CasesState;
  setFilters: (filters: CaseFilters) => void;
  refresh: () => void;
  previousPage: () => void;
  nextPage: () => void;
  loadEvidenceSnapshot: () => Promise<void>;
  submitEvidence: (body: EvidenceCreate) => Promise<void>;
  beginNewEvidence: () => void;
  submitTransition: (body: CaseTransition) => Promise<void>;
  retryTransition: () => Promise<void>;
  beginNewTransition: () => void;
};
export const CasesContext = createContext<CasesContextValue | undefined>(
  undefined,
);
