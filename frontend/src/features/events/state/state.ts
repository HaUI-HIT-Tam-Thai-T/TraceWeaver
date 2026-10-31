import type { ApiError } from "../../../services/apiError.ts";
import type { Event, EventFilters } from "../../../types/events.ts";

export type EventsScope = {
  subject: string;
  workspaceId: string;
  canWrite: boolean;
  accessKey: object;
};
export type EventsState = {
  scope: EventsScope | null;
  status: "idle" | "active" | "blocked" | "reauth" | "invalid-query";
  filters: EventFilters;
  list: {
    status: "idle" | "loading" | "ready" | "error";
    items: Event[];
    error: ApiError | null;
  };
  detail: {
    status: "idle" | "loading" | "ready" | "error";
    id: string | null;
    event: Event | null;
    error: ApiError | null;
  };
  history: (string | null)[];
  pageIndex: number;
  nextCursor: string | null;
  root: Event | null;
  error: ApiError | null;
};

export function initialEventsState(
  scope: EventsScope | null = null,
  filters: EventFilters = { limit: 50 },
): EventsState {
  return {
    scope,
    status: scope ? "active" : "idle",
    filters,
    list: { status: "idle", items: [], error: null },
    detail: { status: "idle", id: null, event: null, error: null },
    history: [null],
    pageIndex: 0,
    nextCursor: null,
    root: null,
    error: null,
  };
}

export type EventsAction =
  | { type: "reset"; state: EventsState }
  | { type: "pageLoading"; history: (string | null)[]; index: number }
  | { type: "pageReady"; items: Event[]; nextCursor: string | null }
  | { type: "pageError"; error: ApiError; invalidCursor: boolean }
  | { type: "detailLoading"; id: string | null }
  | { type: "detailReady"; event: Event }
  | { type: "detailError"; error: ApiError }
  | { type: "root"; event: Event | null };

export function eventsReducer(state: EventsState, action: EventsAction): EventsState {
  switch (action.type) {
    case "reset":
      return action.state;
    case "pageLoading":
      return {
        ...state,
        history: action.history,
        pageIndex: action.index,
        nextCursor: null,
        list: { status: "loading", items: [], error: null },
      };
    case "pageReady":
      return {
        ...state,
        list: { status: "ready", items: action.items, error: null },
        nextCursor: action.nextCursor,
      };
    case "pageError":
      return {
        ...(action.invalidCursor ? initialEventsState(state.scope, state.filters) : state),
        list: { status: "error", items: [], error: action.error },
        nextCursor: null,
      };
    case "detailLoading":
      return {
        ...state,
        detail: {
          status: action.id ? "loading" : "idle",
          id: action.id,
          event: null,
          error: null,
        },
      };
    case "detailReady":
      return {
        ...state,
        detail: {
          status: "ready",
          id: action.event.event_id,
          event: action.event,
          error: null,
        },
      };
    case "detailError":
      return {
        ...state,
        detail: {
          ...state.detail,
          status: "error",
          event: null,
          error: action.error,
        },
      };
    case "root":
      return { ...state, root: action.event };
  }
}
