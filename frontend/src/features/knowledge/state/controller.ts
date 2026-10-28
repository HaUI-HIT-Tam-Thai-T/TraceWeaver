import axios from "axios";
import { ApiError, normalizeApiError } from "../../../services/apiError.ts";
import type { KnowledgeArticle, KnowledgeFilters } from "../schemas.ts";
import type { KnowledgeService } from "../services/createKnowledgeService.ts";
import { readKnowledgeQuery } from "../query.ts";

export type KnowledgeScope = {
  subject: string;
  workspaceId: string;
  accessKey: object;
};
export type KnowledgeState = {
  scope: KnowledgeScope | null;
  status:
    | "idle"
    | "invalid"
    | "loading"
    | "ready"
    | "error"
    | "blocked"
    | "reauth";
  filters: KnowledgeFilters;
  items: KnowledgeArticle[];
  error: ApiError | null;
  cursors: (string | null)[];
  index: number;
  nextCursor: string | null;
};
export const initialKnowledgeState = (): KnowledgeState => ({
  scope: null,
  status: "idle",
  filters: { limit: 50 },
  items: [],
  error: null,
  cursors: [null],
  index: 0,
  nextCursor: null,
});
export function knowledgeReducer(
  state: KnowledgeState,
  patch: Partial<KnowledgeState>,
): KnowledgeState {
  return { ...state, ...patch };
}
const identity = (scope: KnowledgeScope) =>
  JSON.stringify([scope.subject, scope.workspaceId]);
export function createKnowledgeController(
  service: KnowledgeService,
  revalidate: () => Promise<void>,
) {
  let state = initialKnowledgeState();
  let generation = 0;
  let request: AbortController | null = null;
  let denied: { identity: string; error: ApiError } | null = null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<KnowledgeState>) {
    state = knowledgeReducer(state, patch);
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation++;
    request?.abort();
    request = null;
  }
  async function load(
    index = 0,
    cursors: (string | null)[] = [null],
  ): Promise<void> {
    if (
      !state.scope ||
      ["loading", "invalid", "reauth", "blocked"].includes(state.status)
    )
      return;
    const scope = state.scope;
    const filters = state.filters;
    abort();
    const version = generation;
    const controller = new AbortController();
    request = controller;
    const current = () => version === generation && !controller.signal.aborted;
    update({
      status: "loading",
      items: [],
      error: null,
      nextCursor: null,
      index,
      cursors,
    });
    try {
      const cursor = cursors[index];
      const page = await service.listKnowledge(scope.workspaceId, filters, {
        signal: controller.signal,
        ...(cursor ? { cursor } : {}),
      });
      if (!current()) return;
      if (
        page.next_cursor &&
        cursors.slice(0, index + 1).includes(page.next_cursor)
      )
        throw new ApiError({
          kind: "client",
          code: "INVALID_CURSOR",
          message: "Cursor bị lặp. Hãy bắt đầu lại từ trang đầu.",
        });
      update({
        status: "ready",
        items: page.items,
        nextCursor: page.next_cursor,
      });
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) {
        update({ status: "idle" });
        return;
      }
      const safe = normalizeApiError(error);
      if (safe.kind === "auth" || safe.status === 403 || safe.status === 404) {
        const first = denied?.identity !== identity(scope);
        denied = { identity: identity(scope), error: safe };
        abort();
        update({
          ...initialKnowledgeState(),
          scope,
          filters,
          status: safe.kind === "auth" ? "reauth" : "blocked",
          error: safe,
        });
        if (safe.kind !== "auth" && first)
          void revalidate().catch(() => undefined);
      } else
        update({
          status: "error",
          error: safe,
          ...(safe.code === "INVALID_CURSOR"
            ? { cursors: [null], index: 0 }
            : {}),
        });
    }
  }
  function sync(scope: KnowledgeScope | null, search: string) {
    if (!scope) {
      abort();
      update(initialKnowledgeState());
      return;
    }
    if (denied && denied.identity !== identity(scope)) denied = null;
    const query = readKnowledgeQuery(search);
    if (!query.success) {
      abort();
      update({ ...initialKnowledgeState(), scope, status: "invalid" });
      return;
    }
    if (denied) {
      abort();
      update({
        ...initialKnowledgeState(),
        scope,
        filters: query.filters,
        status: denied.error.kind === "auth" ? "reauth" : "blocked",
        error: denied.error,
      });
      return;
    }
    if (
      state.scope?.accessKey === scope.accessKey &&
      state.scope.workspaceId === scope.workspaceId &&
      state.scope.subject === scope.subject &&
      JSON.stringify(state.filters) === JSON.stringify(query.filters) &&
      state.status !== "invalid"
    )
      return;
    abort();
    update({ ...initialKnowledgeState(), scope, filters: query.filters });
    void load();
  }
  function refresh() {
    if (!state.scope || ["loading", "invalid", "reauth"].includes(state.status))
      return Promise.resolve();
    denied = null;
    update({ status: "idle" });
    return load();
  }
  function page(direction: -1 | 1) {
    if (
      state.status !== "ready" ||
      (direction === -1 && state.index === 0) ||
      (direction === 1 && !state.nextCursor)
    )
      return Promise.resolve();
    return load(
      state.index + direction,
      direction === 1
        ? [...state.cursors.slice(0, state.index + 1), state.nextCursor]
        : state.cursors,
    );
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
      denied = null;
      update(initialKnowledgeState());
    },
  };
}
