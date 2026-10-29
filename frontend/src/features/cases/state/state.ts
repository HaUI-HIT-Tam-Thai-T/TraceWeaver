import type { ApiError } from "../../../services/apiError.ts";
import type { Case, CaseDetail, CaseFilters, CaseAssignees } from "../schemas.ts";
import type { Graph, Run } from '../../reconstruction/schemas.ts';
import type { LinkMutation } from '../../link-review/types.ts';
import { initialLinkMutation } from '../../link-review/types.ts';
import type { Event } from '../../events/schemas.ts';
import type { CaseTransition } from '../workflow.ts';

export type CasesScope = {
  subject: string;
  workspaceId: string;
  accessKey: object;
  canWrite?: boolean;
  canVerify?: boolean;
};
export type CaseEvidenceSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  runId: string | null;
  events: Event[];
  graph?: Graph;
  error: ApiError | null;
};
export type CaseEvidenceMutation = {
  status: 'idle' | 'sending' | 'success' | 'uncertain' | 'error' | 'locked';
  error: ApiError | null;
  savedId: string | null;
};
export type CaseWorkflow = {
  status: 'idle' | 'validating' | 'sending' | 'success' | 'uncertain' | 'conflict' | 'error';
  attempt: { body: CaseTransition; key: string; createdAt: number } | null;
  error: ApiError | null;
  resultVersion: number | null;
};
export type CaseWorkflowGraph = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  runId: string | null;
  pendingCount: number | null;
  error: ApiError | null;
};

export type CasesState = {
  assignees: { status: 'idle' | 'loading' | 'ready' | 'error'; items: CaseAssignees['items']; error: ApiError | null };
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
  caseRun: { status: 'idle' | 'loading' | 'ready' | 'error'; run: Run | null; error: ApiError | null };
  linkMutation: LinkMutation;
  snapshot: CaseEvidenceSnapshot;
  evidenceMutation: CaseEvidenceMutation;
  workflow: CaseWorkflow;
  workflowGraph: CaseWorkflowGraph;
};
export const initialWorkflow = (): CaseWorkflow => ({ status: 'idle', attempt: null, error: null, resultVersion: null });
export const initialWorkflowGraph = (): CaseWorkflowGraph => ({ status: 'idle', runId: null, pendingCount: null, error: null });
export const initialEvidenceMutation = (): CaseEvidenceMutation => ({ status: 'idle', error: null, savedId: null });
export const initialEvidenceSnapshot = (): CaseEvidenceSnapshot => ({ status: 'idle', runId: null, events: [], error: null });
export function initialCasesState(
  scope: CasesScope | null = null,
  filters: CaseFilters = { limit: 50 },
): CasesState {
  return {
    assignees: { status: 'idle', items: [], error: null },
    scope,
    status: scope ? "active" : "idle",
    filters,
    list: { status: "idle", items: [], error: null },
    detail: { status: "idle", id: null, data: null, error: null },
    history: [null],
    index: 0,
    nextCursor: null,
    error: null,
    caseRun: { status: 'idle', run: null, error: null },
    linkMutation: initialLinkMutation(),
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
