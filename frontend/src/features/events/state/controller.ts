import axios from "axios";
import { normalizeApiError } from "../../../services/apiError.ts";
import type { ApiError } from "../../../services/apiError.ts";
import type { EventsService } from "../services/createEventsService.ts";
import { initialEventsState, eventsReducer } from "./state.ts";
import type { EventsAction, EventsScope, EventsState } from "./state.ts";
import type { EventFilters } from "../schemas.ts";
import type { EventQuery } from "../query.ts";

export interface EventsController {
  getSnapshot(): EventsState;
  subscribe(listener: () => void): () => void;
  sync(scope: EventsScope | null, visible: boolean, query: EventQuery, loadList?: boolean): void;
  stop(): void;
  refresh(filters?: EventFilters): Promise<void>;
  openDetail(id: string | null): Promise<void>;
  selectRoot(): boolean;
  clearRoot(): void;
  previousPage(): Promise<void>;
  nextPage(): Promise<void>;
}

const scopeId = (scope: EventsScope) =>
  JSON.stringify([scope.subject, scope.workspaceId]);

export function createEventsController(
  service: EventsService,
  revalidateWorkspace: () => Promise<void>,
): EventsController {
  let state = initialEventsState();
  let active = false;
  let generation = 0;
  let detailGeneration = 0;
  let listRequest: AbortController | undefined;
  let detailRequest: AbortController | undefined;
  let listFlight: Promise<void> | undefined;
  let blocked: { id: string; error: ApiError; reauth: boolean } | null = null;
  const listeners = new Set<() => void>();

  function dispatch(action: EventsAction) {
    state = eventsReducer(state, action);
    listeners.forEach((listener) => listener());
  }
  function abortAll() {
    generation += 1;
    detailGeneration += 1;
    listRequest?.abort();
    detailRequest?.abort();
    listFlight = undefined;
  }
  function stop() {
    abortAll();
    active = false;
    blocked = null;
    dispatch({ type: "reset", state: initialEventsState() });
  }
  function deny(error: ApiError) {
    const scope = state.scope;
    if (!scope) return;
    abortAll();
    const reauth = error.kind === "auth";
    const first = blocked?.id !== scopeId(scope);
    blocked = { id: scopeId(scope), error, reauth };
    dispatch({
      type: "reset",
      state: {
        ...initialEventsState(scope, state.filters),
        status: reauth ? "reauth" : "blocked",
        error,
      },
    });
    if (!reauth && first) void revalidateWorkspace().catch(() => undefined);
  }
  function isAccessError(error: ApiError) {
    return (
      error.kind === "auth" || error.status === 403 || error.status === 404
    );
  }

  function openDetail(id: string | null): Promise<void> {
    detailGeneration += 1;
    detailRequest?.abort();
    dispatch({ type: "detailLoading", id });
    if (!id || !state.scope || !active || state.status !== "active")
      return Promise.resolve();
    const scope = state.scope;
    const request = new AbortController();
    detailRequest = request;
    const version = generation;
    const detailVersion = detailGeneration;
    const current = () =>
      active &&
      version === generation &&
      detailVersion === detailGeneration &&
      !request.signal.aborted;
    return Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        const event = await service.getEvent(
          scope.workspaceId,
          id,
          request.signal,
        );
        if (current()) dispatch({ type: "detailReady", event });
      } catch (error: unknown) {
        if (!current() || axios.isCancel(error)) return;
        const failure = normalizeApiError(error);
        if (isAccessError(failure)) deny(failure);
        else dispatch({ type: "detailError", error: failure });
      }
    });
  }

  function loadPage(index: number, history: (string | null)[]): Promise<void> {
    if (!active || !state.scope || state.status !== "active")
      return Promise.resolve();
    listRequest?.abort();
    const request = new AbortController();
    listRequest = request;
    const scope = state.scope;
    const filters = state.filters;
    const version = generation;
    const current = () =>
      active &&
      version === generation &&
      listRequest === request &&
      !request.signal.aborted;
    dispatch({ type: "pageLoading", index, history });
    const task = Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        const page = await service.listEvents(scope.workspaceId, filters, {
          signal: request.signal,
          ...(history[index] ? { cursor: history[index] } : {}),
        });
        if (current())
          dispatch({
            type: "pageReady",
            items: page.items,
            nextCursor: page.next_cursor,
          });
      } catch (error: unknown) {
        if (!current() || axios.isCancel(error)) return;
        const failure = normalizeApiError(error);
        if (isAccessError(failure)) deny(failure);
        else {
          const invalidCursor = failure.code === "INVALID_CURSOR";
          if (invalidCursor) {
            detailGeneration += 1;
            detailRequest?.abort();
          }
          dispatch({ type: "pageError", error: failure, invalidCursor });
        }
      } finally {
        if (listFlight === task) listFlight = undefined;
      }
    });
    listFlight = task;
    return task;
  }

  function refresh(filters: EventFilters = state.filters): Promise<void> {
    if (!active || !state.scope || state.status === "reauth")
      return Promise.resolve();
    abortAll();
    blocked = null;
    dispatch({
      type: "reset",
      state: initialEventsState(state.scope, filters),
    });
    return loadPage(0, [null]);
  }

  function sync(
    scope: EventsScope | null,
    visible: boolean,
    query: EventQuery,
    loadList = true,
  ) {
    if (!scope) {
      abortAll();
      active = false;
      dispatch({ type: "reset", state: initialEventsState() });
      return;
    }
    const sameScope =
      state.scope?.accessKey === scope.accessKey &&
      state.scope.workspaceId === scope.workspaceId &&
      state.scope.subject === scope.subject &&
      state.scope.canWrite === scope.canWrite;
    if (blocked && blocked.id !== scopeId(scope)) blocked = null;
    const wasActive = active;
    active = visible;
    if (!query.success) {
      abortAll();
      dispatch({
        type: "reset",
        state: { ...initialEventsState(scope), status: "invalid-query" },
      });
      return;
    }
    if (blocked) {
      abortAll();
      dispatch({
        type: "reset",
        state: {
          ...initialEventsState(scope, query.filters),
          status: blocked.reauth ? "reauth" : "blocked",
          error: blocked.error,
        },
      });
      return;
    }
    if (!visible) {
      abortAll();
      const root = sameScope ? state.root : null;
      dispatch({
        type: "reset",
        state: { ...initialEventsState(scope, query.filters), root },
      });
      return;
    }
    if (
      !sameScope ||
      !wasActive ||
      JSON.stringify(state.filters) !== JSON.stringify(query.filters)
    ) {
      abortAll();
      dispatch({
        type: "reset",
        state: initialEventsState(scope, query.filters),
      });
      if (loadList) void loadPage(0, [null]);
      void openDetail(query.eventId);
    } else {
      if (loadList && state.list.status === "idle") void loadPage(0, [null]);
      if (state.detail.id !== query.eventId) void openDetail(query.eventId);
    }
  }

  function changePage(direction: -1 | 1): Promise<void> {
    if (listFlight || state.status !== "active") return Promise.resolve();
    const index = state.pageIndex + direction;
    if (index < 0 || (direction === 1 && !state.nextCursor))
      return Promise.resolve();
    const history =
      direction === 1
        ? [...state.history.slice(0, state.pageIndex + 1), state.nextCursor]
        : state.history;
    void openDetail(null);
    return loadPage(index, history);
  }

  function selectRoot(): boolean {
    if (
      !active ||
      state.status !== "active" ||
      !state.scope?.canWrite ||
      state.detail.status !== "ready" ||
      !state.detail.event
    )
      return false;
    dispatch({ type: "root", event: state.detail.event });
    return true;
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
    stop,
    refresh,
    openDetail,
    selectRoot,
    clearRoot: () => dispatch({ type: "root", event: null }),
    previousPage: () => changePage(-1),
    nextPage: () => changePage(1),
  };
}
