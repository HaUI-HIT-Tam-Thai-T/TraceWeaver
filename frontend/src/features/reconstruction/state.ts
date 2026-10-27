import type { ApiError } from "../../services/apiError.ts";
import type { Run, Graph, RunCreate } from "./schemas.ts";
import { initialLinkMutation } from '../link-review/types.ts';
import type { LinkMutation } from '../link-review/types.ts';

export type Attempt = { body: RunCreate; key: string; createdAt: number };
export type ReconstructionState = {
  phase:
    | "idle"
    | "validating"
    | "sending"
    | "known"
    | "uncertain"
    | "error"
    | "blocked"
    | "reauth";
  attempt: Attempt | null;
  run: Run | null;
  graph: Graph | null;
  tracking: "idle" | "waiting" | "loading" | "paused" | "error";
  graphStatus: "idle" | "loading" | "ready" | "error";
  error: ApiError | null;
  mutation: LinkMutation;
  caseLocked: boolean;
};
export function initialReconstructionState(): ReconstructionState {
  return {
    phase: "idle",
    attempt: null,
    run: null,
    graph: null,
    tracking: "idle",
    graphStatus: "idle",
    error: null,
    mutation: initialLinkMutation(),
    caseLocked: false,
  };
}
export type ReconstructionAction =
  | { type: "reset" }
  | { type: "update"; patch: Partial<ReconstructionState> };
export function reconstructionReducer(
  state: ReconstructionState,
  action: ReconstructionAction,
): ReconstructionState {
  return action.type === "reset"
    ? initialReconstructionState()
    : { ...state, ...action.patch };
}
