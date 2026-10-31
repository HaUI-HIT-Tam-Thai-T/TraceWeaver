import axios from "axios";
import { ApiError as SafeApiError, normalizeApiError } from "../../../services/apiError.ts";
import type { ApiError } from "../../../services/apiError.ts";
import type { WorkspaceService } from "../createWorkspaceService.ts";
import type { Source } from "../../../types/workspace.ts";
import {
  activeMembership,
  initialWorkspaceState,
  workspacePermissions,
  workspaceReducer,
} from "./state.ts";
import type { WorkspaceAction, WorkspaceState } from "./state.ts";

type DeniedScope = { workspaceId: string; error: ApiError };

export interface WorkspaceController {
  getSnapshot(): WorkspaceState;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  stop(): void;
  selectWorkspace(workspaceId: string): boolean;
  refreshAccess(): Promise<void>;
  revalidateAccess(): Promise<void>;
  loadMoreSources(): Promise<void>;
}

export function createWorkspaceController(service: WorkspaceService): WorkspaceController {
  let state = initialWorkspaceState();
  let enabled = false;
  let generation = 0;
  let accessRequest: AbortController | undefined;
  let sourceRequest: AbortController | undefined;
  let accessFlight: Promise<void> | undefined;
  let sourceFlight: Promise<void> | undefined;
  let revalidationRequest: AbortController | undefined;
  let revalidationFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();

  function dispatch(action: WorkspaceAction) {
    state = workspaceReducer(state, action);
    listeners.forEach((listener) => listener());
  }

  function invalidateRequests() {
    generation += 1;
    accessRequest?.abort();
    sourceRequest?.abort();
    revalidationRequest?.abort();
    accessFlight = undefined;
    sourceFlight = undefined;
    revalidationFlight = undefined;
  }

  function requireLogin(error: ApiError) {
    invalidateRequests();
    dispatch({ type: "accessError", error, reauth: true });
  }

  function loadSources(append: boolean): Promise<void> {
    if (
      !enabled ||
      state.status !== "ready" ||
      !workspacePermissions(activeMembership(state)).canRead
    ) {
      return Promise.resolve();
    }
    if (sourceFlight) return sourceFlight;
    const workspaceId = state.selectedWorkspaceId;
    const cursor = append ? state.sources.nextCursor : null;
    if (!workspaceId || (append && !cursor)) return Promise.resolve();
    const request = new AbortController();
    sourceRequest = request;
    const version = generation;
    const current = () =>
      enabled &&
      generation === version &&
      !request.signal.aborted &&
      state.selectedWorkspaceId === workspaceId;
    dispatch({ type: "sourcesLoading" });
    const task = Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        let next = cursor;
        let appendPage = append;
        const visited = new Set<string>();
        do {
          if (next !== null) {
            if (visited.has(next))
              throw new SafeApiError({
                kind: "client",
                code: "INVALID_API_RESPONSE",
                message: "Danh sách nguồn trả con trỏ lặp. Hãy tải lại quyền và nguồn.",
              });
            visited.add(next);
          }
          const page = await service.listSources(workspaceId, {
            signal: request.signal,
            limit: 50,
            ...(next ? { cursor: next } : {}),
          });
          if (!current()) return;
          dispatch({ type: "sourcesReady", page, append: appendPage });
          if (!current()) return;
          next = page.next_cursor;
          appendPage = true;
          if (next !== null) dispatch({ type: "sourcesLoading" });
        } while (next !== null && current());
      } catch (error: unknown) {
        if (!current()) return;
        if (axios.isCancel(error)) {
          dispatch({ type: "sourcesCanceled" });
          return;
        }
        const failure = normalizeApiError(error);
        if (failure.kind === "auth") {
          requireLogin(failure);
          return;
        }
        dispatch({ type: "sourcesError", error: failure });
        if (failure.status === 403 || failure.status === 404) {
          void loadAccess({ workspaceId, error: failure });
        }
      } finally {
        if (sourceFlight === task) sourceFlight = undefined;
      }
    });
    sourceFlight = task;
    return task;
  }

  function loadAccess(denied?: DeniedScope): Promise<void> {
    if (!enabled || state.status === "reauth") return Promise.resolve();
    if (accessFlight) {
      const version = generation;
      return denied
        ? accessFlight.then(() => {
            if (enabled && version === generation) return loadAccess(denied);
          })
        : accessFlight;
    }
    const previous = state;
    invalidateRequests();
    const request = new AbortController();
    accessRequest = request;
    const version = generation;
    const current = () => enabled && version === generation && !request.signal.aborted;
    dispatch({ type: "accessLoading" });
    const task = Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        const me = await service.getMe(request.signal);
        if (!current()) return;
        const sameUser = previous.me?.subject === me.subject;
        const retained =
          sameUser &&
          me.memberships.find((item) => item.workspace_id === previous.selectedWorkspaceId);
        const selectedWorkspaceId = retained
          ? retained.workspace_id
          : me.memberships.length === 1
            ? me.memberships[0].workspace_id
            : null;
        dispatch({ type: "accessReady", me, selectedWorkspaceId });
        if (sameUser && denied?.workspaceId === selectedWorkspaceId) {
          dispatch({ type: "sourcesError", error: denied.error });
        } else if (selectedWorkspaceId) {
          void loadSources(false);
        }
      } catch (error: unknown) {
        if (!current()) return;
        if (axios.isCancel(error)) {
          dispatch({ type: "reset" });
          return;
        }
        const failure = normalizeApiError(error);
        if (failure.kind === "auth") requireLogin(failure);
        else dispatch({ type: "accessError", error: failure, reauth: false });
      } finally {
        if (accessFlight === task) accessFlight = undefined;
      }
    });
    accessFlight = task;
    return task;
  }

  function revalidateAccess(): Promise<void> {
    if (!enabled) return Promise.resolve();
    if (revalidationFlight) return revalidationFlight;
    if (accessFlight || sourceFlight) return accessFlight ?? sourceFlight ?? Promise.resolve();
    if (state.status !== "ready" || (state.selectedWorkspaceId && state.sources.status !== "ready"))
      return loadAccess();
    const previous = state;
    const request = new AbortController();
    revalidationRequest = request;
    const version = generation;
    const current = () => enabled && version === generation && !request.signal.aborted;
    const task = Promise.resolve().then(async () => {
      try {
        const me = await service.getMe(request.signal);
        if (!current()) return;
        if (JSON.stringify(me) !== JSON.stringify(previous.me)) {
          await loadAccess();
          return;
        }
        const sources: Source[] = [];
        const visited = new Set<string>();
        let cursor: string | null = null;
        const wid = previous.selectedWorkspaceId;
        if (wid && workspacePermissions(activeMembership(previous)).canRead) {
          do {
            const page = await service.listSources(wid, {
              signal: request.signal,
              limit: 50,
              ...(cursor ? { cursor } : {}),
            });
            if (!current()) return;
            sources.push(...page.items);
            cursor = page.next_cursor;
            if (cursor && visited.has(cursor))
              throw new SafeApiError({
                kind: "client",
                code: "INVALID_API_RESPONSE",
                message: "Danh sách nguồn trả con trỏ lặp. Hãy tải lại quyền và nguồn.",
              });
            if (cursor) visited.add(cursor);
          } while (cursor);
        }
        const ordered = (items: Source[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
        if (JSON.stringify(ordered(sources)) !== JSON.stringify(ordered(previous.sources.items)))
          await loadAccess();
      } catch (error: unknown) {
        if (!current() || axios.isCancel(error)) return;
        const failure = normalizeApiError(error);

        if (failure.kind === "auth") requireLogin(failure);
        else {
          invalidateRequests();
          dispatch({ type: "accessError", error: failure, reauth: false });
        }
      } finally {
        if (revalidationFlight === task) revalidationFlight = undefined;
      }
    });
    revalidationFlight = task;
    return task;
  }

  function selectWorkspace(workspaceId: string): boolean {
    if (
      !enabled ||
      state.status !== "ready" ||
      !state.me?.memberships.some((item) => item.workspace_id === workspaceId)
    )
      return false;
    if (workspaceId === state.selectedWorkspaceId) return true;
    invalidateRequests();
    dispatch({ type: "select", workspaceId });
    void loadSources(false);
    return true;
  }

  function start(): Promise<void> {
    if (enabled) return accessFlight ?? Promise.resolve();
    enabled = true;
    return loadAccess();
  }

  function stop() {
    enabled = false;
    invalidateRequests();
    dispatch({ type: "reset" });
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    stop,
    selectWorkspace,
    refreshAccess: () => loadAccess(),
    revalidateAccess,
    loadMoreSources: () => loadSources(true),
  };
}
