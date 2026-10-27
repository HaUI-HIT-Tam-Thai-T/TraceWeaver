import type { ApiError } from "../../services/apiError.ts";
import type { Case, CaseDetail, CaseFilters } from "./schemas.ts";
import type { Event } from '../events/schemas.ts';

export type CasesScope = {
  subject: string;
  workspaceId: string;
  accessKey: object;
  canWrite?: boolean;
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
};
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
