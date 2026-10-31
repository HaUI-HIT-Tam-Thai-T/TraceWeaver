import axios from "axios";
import { normalizeApiError } from "../../../services/apiError.ts";
import type { ApiError } from "../../../services/apiError.ts";
import type { Dashboard, DashboardFilters } from "../schemas.ts";
import type { DashboardService } from "../createDashboardService.ts";
import { readDashboardQuery } from "../query.ts";
export type DashboardScope = { subject: string; workspaceId: string; accessKey: object };
export type DashboardState = {
  scope: DashboardScope | null;
  filters: DashboardFilters;
  data: Dashboard | null;
  error: ApiError | null;
  status: "idle" | "invalid" | "loading" | "ready" | "error" | "reauth" | "blocked";
  revision: number;
};
export const initialDashboardState = (): DashboardState => ({
  scope: null,
  filters: {},
  data: null,
  error: null,
  status: "idle",
  revision: 0,
});
export function dashboardReducer(
  state: DashboardState,
  patch: Partial<DashboardState>,
): DashboardState {
  return { ...state, ...patch };
}
const identity = (scope: DashboardScope) => JSON.stringify([scope.subject, scope.workspaceId]);
export function createDashboardController(
  service: DashboardService,
  revalidate: () => Promise<void>,
) {
  let state = initialDashboardState(),
    generation = 0;
  let request: AbortController | null = null;
  let denied: { identity: string; error: ApiError } | null = null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<DashboardState>) {
    state = dashboardReducer(state, patch);
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation++;
    request?.abort();
    request = null;
  }
  async function load(): Promise<void> {
    if (!state.scope || ["invalid", "reauth", "blocked"].includes(state.status)) return;
    const scope = state.scope,
      filters = state.filters;
    abort();
    const version = generation,
      controller = new AbortController();
    request = controller;
    const current = () => version === generation && !controller.signal.aborted;
    update({ status: "loading", data: null, error: null });
    try {
      const data = await service.getDashboard(scope.workspaceId, filters, controller.signal);
      if (current()) update({ status: "ready", data });
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
          ...initialDashboardState(),
          scope,
          filters,
          status: safe.kind === "auth" ? "reauth" : "blocked",
          error: safe,
        });
        if (safe.kind !== "auth" && first) void revalidate().catch(() => undefined);
      } else update({ status: "error", data: null, error: safe });
    }
  }
  function sync(scope: DashboardScope | null, search: string) {
    if (!scope) {
      abort();
      update(initialDashboardState());
      return;
    }
    if (denied && denied.identity !== identity(scope)) denied = null;
    const query = readDashboardQuery(search);
    if (!query.success) {
      abort();
      update({ ...initialDashboardState(), scope, status: "invalid" });
      return;
    }
    if (denied) {
      abort();
      update({
        ...initialDashboardState(),
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
    update({ ...initialDashboardState(), scope, filters: query.filters });
    void load();
  }
  function refresh() {
    if (!state.scope || ["invalid", "reauth"].includes(state.status)) return Promise.resolve();
    denied = null;
    update({ status: "idle", data: null, revision: state.revision + 1 });
    return load();
  }
  function invalidateWorkspace(workspaceId: string) {
    if (
      state.scope?.workspaceId === workspaceId &&
      !["reauth", "blocked", "invalid"].includes(state.status)
    )
      void refresh();
  }
  function accessDenied(error: ApiError) {
    if (!state.scope || denied?.identity === identity(state.scope)) return;
    const scope = state.scope;
    denied = { identity: identity(scope), error };
    abort();
    update({
      ...initialDashboardState(),
      scope,
      filters: state.filters,
      error,
      status: error.kind === "auth" ? "reauth" : "blocked",
    });
    if (error.kind !== "auth") void revalidate().catch(() => undefined);
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
    invalidateWorkspace,
    accessDenied,
    stop() {
      abort();
      denied = null;
      update(initialDashboardState());
    },
  };
}
