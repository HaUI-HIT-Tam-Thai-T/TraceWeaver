import type { ApiError } from "../../services/apiError.ts";
import type { Command, Sandbox, Proofs, Proof, Lab } from "./schemas.ts";
export type Remote<T> = {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: ApiError | null;
};
export type SandboxState = {
  snapshot: Remote<Sandbox>;
  proofs: Remote<Proofs>;
  lab: Remote<Lab>;
  mutation: {
    status: "idle" | "sending" | "success" | "conflict" | "error" | "uncertain";
    error: ApiError | null;
    kind: "command" | "proof" | null;
    intent: Command | null;
    execution: Sandbox["execution"] | null;
    savedProof: Proof | null;
    reconciled: boolean;
  };
};
export function initialSandboxState(): SandboxState {
  return {
    snapshot: { status: "idle", data: null, error: null },
    proofs: { status: "idle", data: null, error: null },
    lab: { status: "idle", data: null, error: null },
    mutation: {
      status: "idle",
      error: null,
      kind: null,
      intent: null,
      execution: null,
      savedProof: null,
      reconciled: false,
    },
  };
}
