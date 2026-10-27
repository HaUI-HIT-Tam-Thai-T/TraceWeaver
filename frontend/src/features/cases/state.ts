import type { ApiError } from "../../services/apiError.ts";
import type { Case, CaseDetail, CaseFilters } from "./schemas.ts";
import type { Event } from '../events/schemas.ts';
import type { CaseTransition } from './workflow.ts';

export type CasesScope = {
  subject: string;
  workspaceId: string;
  accessKey: object;
  canWrite?: boolean;
  canVerify?: boolean;
};
export type CasesState = {
  scope: CasesScope | null;
  status: "idle" | "active" | "invalid" | "blocked" | "reauth";
  filters: CaseFilters;
  list: {
    status: "idle" | "loading" | "ready" | "error";
    items: Case[];
    error: ApiError | null;
  };
  detail: {
    status: "idle" | "loading" | "ready" | "error";
    id: string | null;
    data: CaseDetail | null;
    error: ApiError | null;
  };
  history: (string | null)[];
  index: number;
  nextCursor: string | null;
  error: ApiError | null;
  snapshot: { status: 'idle' | 'loading' | 'ready' | 'error'; runId: string | null; events: Event[]; error: ApiError | null };
  evidenceMutation: { status: 'idle' | 'sending' | 'success' | 'uncertain' | 'error' | 'locked'; error: ApiError | null; savedId: string | null };
  workflow: {
    status: 'idle' | 'validating' | 'sending' | 'success' | 'uncertain' | 'conflict' | 'error';
    attempt: { body: CaseTransition; key: string; createdAt: number } | null;
    error: ApiError | null;
    resultVersion: number | null;
  };
  workflowGraph: { status: 'idle' | 'loading' | 'ready' | 'error'; runId: string | null; pendingCount: number | null; error: ApiError | null };
};
export const initialWorkflow = (): CasesState['workflow'] => ({ status: 'idle', attempt: null, error: null, resultVersion: null });
export const initialWorkflowGraph = (): CasesState['workflowGraph'] => ({ status: 'idle', runId: null, pendingCount: null, error: null });
export const initialEvidenceMutation = (): CasesState['evidenceMutation'] => ({ status: 'idle', error: null, savedId: null });
export const initialEvidenceSnapshot = (): CasesState['snapshot'] => ({ status: 'idle', runId: null, events: [], error: null });
export function initialCasesState(
  scope: CasesScope | null = null,
  filters: CaseFilters = { limit: 50 },
): CasesState {
  return {
    scope,
    status: scope ? "active" : "idle",
    filters,
    list: { status: "idle", items: [], error: null },
    detail: { status: "idle", id: null, data: null, error: null },
    history: [null],
    index: 0,
    nextCursor: null,
    error: null,
    snapshot: initialEvidenceSnapshot(),
    evidenceMutation: initialEvidenceMutation(),
    workflow: initialWorkflow(),
    workflowGraph: initialWorkflowGraph(),
  };
}
export type CasesAction =
  | { type: "reset"; state: CasesState }
  | { type: "update"; patch: Partial<CasesState> };
export function casesReducer(
  state: CasesState,
  action: CasesAction,
): CasesState {
  return action.type === "reset" ? action.state : { ...state, ...action.patch };
}
