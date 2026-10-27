import axios from "axios";
import { ApiError, normalizeApiError } from "../../services/apiError.ts";
import type { Event } from "../events/schemas.ts";
import type { EventsScope } from "../events/state.ts";
import type { ReconstructionService } from "./createReconstructionService.ts";
import { invalidRunResponse } from "./createReconstructionService.ts";
import { runCreateSchema, validateRoot } from "./schemas.ts";
import type { Run, RunCreate } from "./schemas.ts";
import { initialReconstructionState, reconstructionReducer } from "./state.ts";
import type { ReconstructionState } from "./state.ts";

type Dependencies = {
  service: ReconstructionService;
  getEvent: (
    workspaceId: string,
    eventId: string,
    signal?: AbortSignal,
  ) => Promise<Event>;
  revalidate: () => Promise<void>;
  now?: () => number;
  newKey?: () => string;
  schedule?: (callback: () => void, delay: number) => () => void;
};
const pending = (run: Run) =>
  run.status === "queued" || run.status === "running";
const invalidInput = () =>
  new ApiError({
    kind: "client",
    code: "INVALID_RUN_INPUT",
    message:
      "Root, nguồn hoặc khoảng thời gian không hợp lệ. Kiểm tra lại thông tin.",
  });

export function createReconstructionController(deps: Dependencies) {
  let state = initialReconstructionState();
  let scope: EventsScope | null = null;
  let root: Event | null = null;
  let generation = 0;
  let request: AbortController | null = null;
  let cancelTimer: (() => void) | undefined;
  let busy = false;
  let deadline = 0;
  let pollStep = 0;
  let revalidated = false;
  const listeners = new Set<() => void>();
  const now = deps.now ?? Date.now;
  const schedule =
    deps.schedule ??
    ((callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    });
  function update(patch: Partial<ReconstructionState>) {
    state = reconstructionReducer(state, { type: "update", patch });
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation += 1;
    request?.abort();
    cancelTimer?.();
    cancelTimer = undefined;
    busy = false;
  }
  function reset() {
    abort();
    state = reconstructionReducer(state, { type: "reset" });
    listeners.forEach((listener) => listener());
  }
  function sync(nextScope: EventsScope | null, nextRoot: Event | null) {
    if (
      scope?.accessKey !== nextScope?.accessKey ||
      scope?.workspaceId !== nextScope?.workspaceId ||
      scope?.subject !== nextScope?.subject ||
      scope?.canWrite !== nextScope?.canWrite ||
      root !== nextRoot
    ) {
      reset();
      revalidated = false;
    }
    scope = nextScope;
    root = nextRoot;
  }
  function failure(
    error: unknown,
    stage: "create" | "track" | "graph",
    sent = false,
  ) {
    if (axios.isCancel(error)) return;
    const safe = normalizeApiError(error);
    if (safe.kind === "auth" || safe.status === 403 || safe.status === 404) {
      reset();
      update({
        phase: safe.kind === "auth" ? "reauth" : "blocked",
        error: safe,
      });
      if (safe.kind !== "auth" && !revalidated) {
        revalidated = true;
        void deps.revalidate().catch(() => undefined);
      }
      return;
    }
    if (stage === "create") {
      const uncertain =
        sent &&
        (safe.kind === "network" ||
          safe.kind === "timeout" ||
          safe.code === "INVALID_API_RESPONSE" ||
          (safe.status ?? 0) >= 500);
      update({ phase: uncertain ? "uncertain" : "error", error: safe });
    } else
      update({
        error: safe,
        ...(stage === "graph"
          ? { graphStatus: "error" }
          : { tracking: "error" }),
      });
  }
  function available() {
    return (
      scope !== null &&
      scope.canWrite &&
      root !== null &&
      state.phase !== "blocked" &&
      state.phase !== "reauth"
    );
  }
  function beginRequest() {
    busy = true;
    const version = generation;
    const controller = new AbortController();
    request = controller;
    return {
      signal: controller.signal,
      current: () => version === generation && !controller.signal.aborted,
    };
  }
  function queuePoll() {
    const run = state.run;
    if (!run || !pending(run)) return;
    if (now() >= deadline) {
      update({ tracking: "paused" });
      return;
    }
    const delay = Math.min(
      [1000, 2000, 4000, 8000, 10000][Math.min(pollStep++, 4)] ?? 10000,
      deadline - now(),
    );
    const version = generation;
    update({ tracking: "waiting" });
    cancelTimer = schedule(() => {
      if (version !== generation) return;
      cancelTimer = undefined;
      if (now() >= deadline) update({ tracking: "paused" });
      else void track(false);
    }, delay);
  }
  async function loadGraph(): Promise<void> {
    if (busy || !available() || !scope || state.run?.status !== "completed")
      return;
    const run = state.run;
    const body = state.attempt?.body;
    const operation = beginRequest();
    update({ graph: null, graphStatus: "loading", error: null });
    try {
      const graph = await deps.service.getGraph(
        scope.workspaceId,
        run.id,
        operation.signal,
      );
      if (!operation.current()) return;
      if (
        !graph.nodes.some((node) => node.event_id === run.root_event_id) ||
        (body &&
          graph.nodes.some(
            (node) =>
              !body.source_ids.includes(node.source_id) ||
              !validateRoot({ ...body, root_event_id: node.event_id }, node),
          ))
      )
        throw invalidRunResponse();
      update({ graph, graphStatus: "ready" });
    } catch (error: unknown) {
      if (operation.current()) failure(error, "graph");
    } finally {
      if (operation.current()) busy = false;
    }
  }
  async function acceptRun(run: Run) {
    update({ phase: "known", run, error: null, tracking: "idle" });
    if (run.status === "completed") await loadGraph();
    else if (pending(run)) queuePoll();
  }
  async function track(manual = true): Promise<void> {
    if (busy || !available() || !scope || !state.run || !pending(state.run))
      return;
    cancelTimer?.();
    cancelTimer = undefined;
    if (manual) {
      deadline = now() + 300000;
      pollStep = 0;
    }
    const previous = state.run;
    const operation = beginRequest();
    update({ tracking: "loading", error: null });
    try {
      const run = await deps.service.getRun(
        scope.workspaceId,
        previous.id,
        operation.signal,
      );
      if (!operation.current()) return;
      if (
        run.root_event_id !== previous.root_event_id ||
        run.mode !== previous.mode ||
        run.input_snapshot_id !== previous.input_snapshot_id
      )
        throw invalidRunResponse();
      busy = false;
      await acceptRun(run);
    } catch (error: unknown) {
      if (operation.current()) failure(error, "track");
    } finally {
      if (operation.current()) busy = false;
    }
  }
  async function send(retry: boolean, input?: RunCreate): Promise<void> {
    if (busy || !available() || !scope || !root || state.run) return;
    if (!retry && state.phase !== "idle") return;
    const retained = state.attempt;
    if (retry && (state.phase !== "uncertain" || !retained)) return;
    if (retry && retained && now() - retained.createdAt >= 86400000) {
      update({
        phase: "error",
        error: new ApiError({
          kind: "client",
          code: "IDEMPOTENCY_EXPIRED",
          message:
            "Đã quá 24 giờ; không gửi lại thao tác cũ. Run trước vẫn có thể đã được tạo.",
        }),
      });
      return;
    }
    const parsed = runCreateSchema.safeParse(retry ? retained?.body : input);
    if (!parsed.success || !validateRoot(parsed.data, root)) {
      update({ phase: "error", error: invalidInput() });
      return;
    }
    const selectedRoot = root;
    const operation = beginRequest();
    let sent = false;
    update({ phase: "validating", error: null });
    try {
      const checkedRoot = await deps.getEvent(
        scope.workspaceId,
        selectedRoot.event_id,
        operation.signal,
      );
      if (!operation.current()) return;
      if (
        checkedRoot.source_id !== selectedRoot.source_id ||
        !validateRoot(parsed.data, checkedRoot)
      )
        throw invalidInput();
      if (retry && retained && now() - retained.createdAt >= 86400000) {
        update({ phase: "error", error: new ApiError({ kind: "client", code: "IDEMPOTENCY_EXPIRED", message: "Đã quá 24 giờ; không gửi lại thao tác cũ. Run trước vẫn có thể đã được tạo." }) });
        return;
      }
      const attempt =
        retained && retry
          ? retained
          : {
              body: parsed.data,
              key: (deps.newKey ?? (() => crypto.randomUUID()))(),
              createdAt: now(),
            };
      update({ phase: "sending", attempt });
      sent = true;
      const run = await deps.service.createRun(
        scope.workspaceId,
        attempt.body,
        { idempotencyKey: attempt.key, signal: operation.signal },
      );
      if (!operation.current()) return;
      busy = false;
      deadline = now() + 300000;
      pollStep = 0;
      await acceptRun(run);
    } catch (error: unknown) {
      if (operation.current()) failure(error, "create", sent || retry);
    } finally {
      if (operation.current()) busy = false;
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
    stop() {
      reset();
      scope = null;
      root = null;
    },
    matches: (accessKey: object, selectedRoot: Event) =>
      scope?.accessKey === accessKey && root === selectedRoot,
    create: (body: RunCreate) => send(false, body),
    retry: () => send(true),
    newOperation() {
      if (available() && !busy) reset();
    },
    track,
    loadGraph,
  };
}
