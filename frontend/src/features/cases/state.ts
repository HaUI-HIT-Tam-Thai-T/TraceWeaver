import type { ApiError } from "../../services/apiError.ts";
import type { Case, CaseDetail, CaseFilters } from "./schemas.ts";

export type CasesScope = {
  subject: string;
  workspaceId: string;
  accessKey: object;
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
};
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
