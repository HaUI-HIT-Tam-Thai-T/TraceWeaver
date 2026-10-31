import axios from "axios";
import { ApiError, normalizeApiError } from "../../../services/apiError.ts";
import type { ApiError as ApiErrorType } from "../../../services/apiError.ts";
import type { EventsScope } from "../../events/state/state.ts";
import type { Run } from "../../../types/reconstruction.ts";
import type { CasesService } from "../createCasesService.ts";
import { invalidCaseInput } from "../createCasesService.ts";
import { caseCreateSchema } from "../schemas.ts";
import type { CaseCreate } from "../../../types/cases.ts";

export type CaseCreationState = {
  status:
    | "idle"
    | "validating"
    | "sending"
    | "uncertain"
    | "error"
    | "success"
    | "blocked"
    | "reauth";
  attempt: { body: CaseCreate; key: string; createdAt: number } | null;
  caseId: string | null;
  error: ApiErrorType | null;
};
export const initialCaseCreation = (): CaseCreationState => ({
  status: "idle",
  attempt: null,
  caseId: null,
  error: null,
});
type Dependencies = {
  service: Pick<CasesService, "createCase">;
  getRun: (wid: string, rid: string, signal?: AbortSignal) => Promise<Run>;
  revalidate: () => Promise<void>;
  now?: () => number;
  newKey?: () => string;
};
export function createCaseCreationController(deps: Dependencies) {
  let state = initialCaseCreation();
  let binding: { scope: EventsScope; runId: string; anchor: object } | null = null;
  let generation = 0;
  let request: AbortController | null = null;
  let busy = false;
  let revalidated = false;
  const listeners = new Set<() => void>();
  const now = deps.now ?? Date.now;
  const update = (patch: Partial<CaseCreationState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  function reset() {
    generation++;
    request?.abort();
    busy = false;
    state = initialCaseCreation();
    listeners.forEach((listener) => listener());
  }
  function sync(scope: EventsScope | null, runId: string | null, anchor: object | null) {
    if (!scope || !runId || !anchor) {
      reset();
      binding = null;
      revalidated = false;
      return;
    }
    if (
      binding?.scope.accessKey !== scope.accessKey ||
      binding.scope.workspaceId !== scope.workspaceId ||
      binding.scope.subject !== scope.subject ||
      binding.scope.canWrite !== scope.canWrite ||
      binding.runId !== runId ||
      binding.anchor !== anchor
    ) {
      reset();
      revalidated = false;
    }
    binding = { scope, runId, anchor };
  }
  function expired() {
    if (!state.attempt || now() - state.attempt.createdAt < 86400000) return false;
    update({
      status: "error",
      error: new ApiError({
        kind: "client",
        code: "IDEMPOTENCY_EXPIRED",
        message: "Đã quá 24 giờ. Case trước có thể đã được tạo; không gửi lại thao tác cũ.",
      }),
    });
    return true;
  }
  async function send(title?: string, retry = false): Promise<void> {
    if (
      busy ||
      !binding?.scope.canWrite ||
      state.caseId ||
      (retry ? state.status !== "uncertain" : state.status !== "idle")
    )
      return;
    if (retry && expired()) return;
    const currentBinding = binding;
    const retained = state.attempt;
    const parsed = caseCreateSchema.safeParse(
      retry ? retained?.body : { run_id: binding.runId, title },
    );
    if (!parsed.success || parsed.data.run_id !== binding.runId) {
      update({ status: "error", error: invalidCaseInput() });
      return;
    }
    const version = generation;
    const controller = new AbortController();
    request = controller;
    const current = () => version === generation && !controller.signal.aborted;
    busy = true;
    let sent = false;
    update({ status: "validating", error: null });
    try {
      const run = await deps.getRun(
        currentBinding.scope.workspaceId,
        currentBinding.runId,
        controller.signal,
      );
      if (!current()) return;
      if (run.id !== currentBinding.runId || run.status !== "completed")
        throw new ApiError({
          kind: "client",
          code: "RUN_NOT_READY",
          message: "Run chưa completed hoặc không hợp lệ. Kiểm tra run trước khi tạo case.",
        });
      if (retry && expired()) return;
      const attempt =
        retry && retained
          ? retained
          : {
              body: parsed.data,
              key: (deps.newKey ?? (() => crypto.randomUUID()))(),
              createdAt: now(),
            };
      update({ status: "sending", attempt });
      sent = true;
      const result = await deps.service.createCase(currentBinding.scope.workspaceId, attempt.body, {
        idempotencyKey: attempt.key,
        signal: controller.signal,
      });
      if (current()) update({ status: "success", caseId: result.id, error: null });
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) {
        update({ status: sent || retry ? "uncertain" : "idle", error: null });
        return;
      }
      const safe = normalizeApiError(error);
      if (safe.kind === "auth" || safe.status === 403 || safe.status === 404) {
        reset();
        update({
          status: safe.kind === "auth" ? "reauth" : "blocked",
          error: safe,
        });
        if (safe.kind !== "auth" && !revalidated) {
          revalidated = true;
          void deps.revalidate().catch(() => undefined);
        }
      } else {
        const uncertain =
          (sent || retry) &&
          (safe.kind === "network" ||
            safe.kind === "timeout" ||
            safe.code === "INVALID_API_RESPONSE" ||
            (safe.status ?? 0) >= 500);
        update({ status: uncertain ? "uncertain" : "error", error: safe });
      }
    } finally {
      if (current()) busy = false;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sync,
    create: (title: string) => send(title),
    retry: () => send(undefined, true),
    matches: (scope: EventsScope, rid: string, anchor: object) =>
      binding?.scope.accessKey === scope.accessKey &&
      binding.scope.workspaceId === scope.workspaceId &&
      binding.scope.subject === scope.subject &&
      binding.scope.canWrite === scope.canWrite &&
      binding.runId === rid &&
      binding.anchor === anchor,
    newOperation() {
      if (
        !busy &&
        binding?.scope.canWrite &&
        state.status !== "reauth" &&
        state.status !== "blocked"
      )
        reset();
    },
    stop() {
      reset();
      binding = null;
    },
  };
}
