import type { CaseTransition } from '../workflow';
import { createContext } from "react";
import type { CasesState } from "./state";
import type { CaseFilters } from "../schemas";
import type { EvidenceCreate } from '../schemas';

import type { ReviewCreate, ManualLinkCreate } from '../../link-review/schemas';
import type { Command } from '../../case-sandbox/schemas';
export type CasesContextValue = {
  loadSandbox: () => Promise<void>;
  submitSandboxCommand: (body: Command) => Promise<void>;
  retrySandboxProvision: () => Promise<void>;
  saveSandboxProof: () => Promise<void>;
  beginSandboxIntent: () => void;
  loadCaseAssignees: () => Promise<void>;
  loadCaseRun: (force?: boolean) => Promise<void>;
  reviewCaseLink: (id: string, body: ReviewCreate) => Promise<void>;
  createCaseManualLink: (body: ManualLinkCreate) => Promise<void>;
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
