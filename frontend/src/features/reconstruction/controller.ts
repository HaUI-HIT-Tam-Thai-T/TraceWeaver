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
import type { LinkReviewService } from "../link-review/createLinkReviewService.ts";
import {
  manualLinkCreateSchema,
  reviewCreateSchema,
  manualLinkIssue,
} from "../link-review/schemas.ts";
import type { ManualLinkCreate, ReviewCreate } from "../link-review/schemas.ts";

type Dependencies = {
  service: ReconstructionService;
  linkService?: LinkReviewService;
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
    update({ graphStatus: "loading", error: null });
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
  async function mutateLink(
    input:
      | { kind: "review"; linkId: string; body: ReviewCreate }
      | { kind: "manual"; body: ManualLinkCreate },
  ): Promise<void> {
    if (
      busy ||
      !available() ||
      !scope ||
      state.run?.status !== "completed" ||
      state.graphStatus !== "ready" ||
      !state.graph ||
      state.caseLocked ||
      !deps.linkService
    )
      return;
    const graph = state.graph;
    const wid = scope.workspaceId;
    const rid = state.run.id;
    const body =
      input.kind === "review"
        ? reviewCreateSchema.safeParse(input.body)
        : manualLinkCreateSchema.safeParse(input.body);
    const link =
      input.kind === "review"
        ? graph.links.find((link) => link.id === input.linkId)
        : undefined;
    const issue =
      input.kind === "manual" && body.success
        ? manualLinkIssue(input.body, graph)
        : null;
    const conflict =
      input.kind === "review" &&
      link &&
      link.version !== input.body.expected_version;
    if (
      !body.success ||
      (input.kind === "review" && !link) ||
      issue ||
      conflict
    ) {
      const code = conflict
        ? "VERSION_CONFLICT"
        : (issue ?? "INVALID_LINK_INPUT");
      update({
        mutation: {
          status: conflict
            ? "conflict"
            : issue === "LINK_EXISTS"
              ? "duplicate"
              : "error",
          error: new ApiError({
            kind: "client",
            code,
            message: "Kiểm tra link, phiên bản và lý do trước khi gửi.",
          }),
          linkId:
            input.kind === "review"
              ? input.linkId
              : (graph.links.find(
                  (link) =>
                    link.from_event_id === input.body.from_event_id &&
                    link.to_event_id === input.body.to_event_id,
                )?.id ?? null),
        },
      });
      if (issue === "LINK_EXISTS" || conflict) await loadGraph();
      return;
    }
    const operation = beginRequest();
    update({
      mutation: {
        status: "sending",
        error: null,
        linkId: input.kind === "review" ? input.linkId : null,
      },
    });
    let refetch = false;
    try {
      if (input.kind === "review")
        await deps.linkService.reviewLink(
          wid,
          rid,
          input.linkId,
          reviewCreateSchema.parse(input.body),
          operation.signal,
        );
      else
        await deps.linkService.createManualLink(
          wid,
          rid,
          manualLinkCreateSchema.parse(input.body),
          operation.signal,
        );
      if (!operation.current()) return;
      update({
        mutation: {
          status: "success",
          error: null,
          linkId: input.kind === "review" ? input.linkId : null,
        },
      });
      refetch = true;
    } catch (error: unknown) {
      if (!operation.current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === "auth" || safe.status === 403 || safe.status === 404) {
        failure(error, "graph");
        return;
      }
      const uncertain =
        axios.isCancel(error) ||
        safe.kind === "network" ||
        safe.kind === "timeout" ||
        safe.code === "INVALID_API_RESPONSE" ||
        (safe.status ?? 0) >= 500;
      const status = uncertain
        ? "uncertain"
        : safe.code === "VERSION_CONFLICT"
          ? "conflict"
          : safe.code === "LINK_EXISTS"
            ? "duplicate"
            : safe.code === "CASE_CLOSED"
              ? "locked"
              : "error";
      update({
        mutation: {
          status,
          error: axios.isCancel(error) ? null : safe,
          linkId: input.kind === "review" ? input.linkId : null,
        },
        caseLocked: status === "locked" || state.caseLocked,
      });
      refetch =
        uncertain ||
        status === "conflict" ||
        status === "duplicate" ||
        status === "locked";
    } finally {
      if (operation.current()) busy = false;
    }
    if (refetch && operation.current()) await loadGraph();
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
    reviewLink: (linkId: string, body: ReviewCreate) =>
      mutateLink({ kind: "review", linkId, body }),
    createManualLink: (body: ManualLinkCreate) =>
      mutateLink({ kind: "manual", body }),
    probeClosedCase() {
      if (
        !busy &&
        available() &&
        state.graphStatus === "ready" &&
        state.caseLocked
      ) {
        update({
          caseLocked: false,
          mutation: { status: "idle", error: null, linkId: null },
        });
      }
    },
  };
}
