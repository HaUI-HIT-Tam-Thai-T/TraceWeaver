import axios from "axios";
import { z } from "zod";
import { normalizeApiError } from "../../services/apiError.ts";
import type { ApiError } from "../../services/apiError.ts";
import type { CasesService } from "./createCasesService.ts";
import { readCaseQuery } from "./query.ts";
import { casesReducer, initialCasesState } from "./state.ts";
import type { CasesScope, CasesState } from "./state.ts";

export type CasesView =
  | { kind: "none" }
  | { kind: "list"; search: string }
  | { kind: "detail"; search: string; caseId: string };
const scopeId = (scope: CasesScope) =>
  JSON.stringify([scope.subject, scope.workspaceId]);
export function createCasesController(
  service: Pick<CasesService, "listCases" | "getCase">,
  revalidate: () => Promise<void>,
) {
  let state = initialCasesState();
  let view: CasesView = { kind: "none" };
  let generation = 0;
  let request: AbortController | null = null;
  let busy = false;
  let blocked: { key: string; error: ApiError } | null = null;
  const listeners = new Set<() => void>();
  function reset(next: CasesState) {
    state = casesReducer(state, { type: "reset", state: next });
    listeners.forEach((listener) => listener());
  }
  function update(patch: Partial<CasesState>) {
    state = casesReducer(state, { type: "update", patch });
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation++;
    request?.abort();
    busy = false;
  }
  function deny(error: ApiError) {
    const scope = state.scope;
    if (!scope) return;
    const first = blocked?.key !== scopeId(scope);
    blocked = { key: scopeId(scope), error };
    abort();
    reset({
      ...initialCasesState(scope, state.filters),
      status: error.kind === "auth" ? "reauth" : "blocked",
      error,
    });
    if (error.kind !== "auth" && first)
      void revalidate().catch(() => undefined);
  }
  async function load(
    index = 0,
    history: (string | null)[] = [null],
  ): Promise<void> {
    if (
      busy ||
      !state.scope ||
      state.status !== "active" ||
      view.kind === "none"
    )
      return;
    const scope = state.scope;
    const currentView = view;
    const filters = state.filters;
    const controller = new AbortController();
    request = controller;
    const version = generation;
    const current = () =>
      version === generation &&
      !controller.signal.aborted &&
      request === controller;
    busy = true;
    if (currentView.kind === "list")
      update({
        index,
        history,
        nextCursor: null,
        list: { status: "loading", items: [], error: null },
      });
    else
      update({
        detail: {
          status: "loading",
          id: currentView.caseId,
          data: null,
          error: null,
        },
      });
    try {
      if (currentView.kind === "list") {
        const cursor = history[index];
        const page = await service.listCases(scope.workspaceId, filters, {
          signal: controller.signal,
          ...(cursor ? { cursor } : {}),
          limit: filters.limit,
        });
        if (current())
          update({
            list: { status: "ready", items: page.items, error: null },
            nextCursor: page.next_cursor,
          });
      } else {
        const detail = await service.getCase(
          scope.workspaceId,
          currentView.caseId,
          controller.signal,
        );
        if (current())
          update({
            detail: {
              status: "ready",
              id: currentView.caseId,
              data: detail,
              error: null,
            },
          });
      }
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) {
        if (currentView.kind === 'list') update({ list: { status: 'idle', items: [], error: null } });
        else update({ detail: { status: 'idle', id: currentView.caseId, data: null, error: null } });
        return;
      }
      const safe = normalizeApiError(error);
      if (safe.kind === "auth" || safe.status === 403 || safe.status === 404)
        deny(safe);
      else if (currentView.kind === "list") {
        update({
          list: { status: "error", items: [], error: safe },
          nextCursor: null,
          ...(safe.code === "INVALID_CURSOR"
            ? { history: [null], index: 0, detail: initialCasesState().detail }
            : {}),
        });
      } else
        update({
          detail: {
            status: "error",
            id: currentView.caseId,
            data: null,
            error: safe,
          },
        });
    } finally {
      if (current()) busy = false;
    }
  }
  function sync(scope: CasesScope | null, nextView: CasesView) {
    const previousView = view;
    view = nextView;
    if (!scope || nextView.kind === "none") {
      abort();
      reset(initialCasesState());
      return;
    }
    const query = readCaseQuery(nextView.search);
    if (
      !query.success ||
      (nextView.kind === "detail" &&
        !z.uuid().safeParse(nextView.caseId).success)
    ) {
      abort();
      reset({ ...initialCasesState(scope), status: "invalid" });
      return;
    }
    const same =
      state.scope?.accessKey === scope.accessKey &&
      state.scope.workspaceId === scope.workspaceId &&
      state.scope.subject === scope.subject;
    if (blocked && blocked.key !== scopeId(scope)) blocked = null;
    if (blocked) {
      abort();
      reset({
        ...initialCasesState(scope, query.filters),
        status: blocked.error.kind === "auth" ? "reauth" : "blocked",
        error: blocked.error,
      });
      return;
    }
    if (
      !same ||
      state.status === 'invalid' ||
      previousView.kind !== nextView.kind ||
      (previousView.kind === "detail" &&
        nextView.kind === "detail" &&
        previousView.caseId !== nextView.caseId) ||
      JSON.stringify(state.filters) !== JSON.stringify(query.filters)
    ) {
      abort();
      reset(initialCasesState(scope, query.filters));
      void load();
    }
  }
  function refresh(): Promise<void> {
    if (
      !state.scope ||
      view.kind === "none" ||
      state.status === "reauth" ||
      state.status === "invalid"
    )
      return Promise.resolve();
    blocked = null;
    abort();
    reset(initialCasesState(state.scope, state.filters));
    return load();
  }
  function page(direction: -1 | 1): Promise<void> {
    if (busy || view.kind !== "list" || state.status !== "active")
      return Promise.resolve();
    const index = state.index + direction;
    if (index < 0 || (direction === 1 && !state.nextCursor))
      return Promise.resolve();
    const history =
      direction === 1
        ? [...state.history.slice(0, state.index + 1), state.nextCursor]
        : state.history;
    return load(index, history);
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
    refresh,
    previousPage: () => page(-1),
    nextPage: () => page(1),
    stop() {
      abort();
      blocked = null;
      view = { kind: "none" };
      reset(initialCasesState());
    },
  };
}
