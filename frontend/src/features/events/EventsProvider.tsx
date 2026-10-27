import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useWorkspace } from "../workspace/workspaceContext";
import { createEventsController } from "./controller";
import { eventsService } from "./service";
import { readEventQuery, writeEventQuery } from "./query";
import { initialEventsState } from "./state";
import { EventsContext } from "./eventsContext";

const hiddenState = initialEventsState();

export function EventsProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const {
    state: workspace,
    membership,
    permissions,
    refreshAccess,
  } = useWorkspace();
  const [controller] = useState(() =>
    createEventsController(eventsService, refreshAccess),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const lastScope = useRef<string | null>(null);
  const me = workspace.me;
  const workspaceId = membership?.workspace_id ?? null;
  const allowed =
    auth.status === "authenticated" &&
    workspace.status === "ready" &&
    permissions.canRead &&
    me !== null &&
    workspaceId !== null;
  const visible = location.pathname === "/events";

  useEffect(() => {
    if (auth.status !== "authenticated") {
      lastScope.current = null;
      controller.stop();
      if (visible && location.search)
        setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }
    if (!allowed || !me || !workspaceId) {
      controller.sync(null, visible, readEventQuery(location.search));
      return;
    }
    const key = JSON.stringify([me.subject, workspaceId]);
    const changed = lastScope.current !== null && lastScope.current !== key;
    lastScope.current = key;
    const scope = {
      subject: me.subject,
      workspaceId,
      canWrite: permissions.canWrite,
      accessKey: me,
    };
    if (changed && visible) {
      const query = readEventQuery("");
      controller.sync(scope, visible, query);
      setSearchParams(new URLSearchParams(), { replace: true });
    } else {
      controller.sync(scope, visible, readEventQuery(location.search));
    }
  }, [
    auth.status,
    allowed,
    me,
    workspaceId,
    permissions.canWrite,
    visible,
    location.search,
    controller,
    setSearchParams,
  ]);

  useEffect(() => () => controller.stop(), [controller]);

  useEffect(() => {
    if (visible && snapshot.list.error?.code === "INVALID_CURSOR") {
      const query = readEventQuery(location.search);
      if (query.success && query.eventId)
        setSearchParams(writeEventQuery(query.filters), { replace: true });
    }
  }, [snapshot.list.error, visible, location.search, setSearchParams]);

  // Identity response object changes on every access revalidation, even for the same subject.
  const state =
    allowed &&
    snapshot.scope?.accessKey === me &&
    snapshot.scope.workspaceId === workspaceId
      ? snapshot
      : hiddenState;
  const query = readEventQuery(location.search);
  const filters = query.success ? query.filters : { limit: 50 };
  const clearDetailQuery = () => setSearchParams(writeEventQuery(filters));
  return (
    <EventsContext.Provider
      value={{
        state,
        setFilters(next) {
          setSearchParams(writeEventQuery(next));
          void controller.refresh(next);
        },
        showEvent(id) {
          setSearchParams(writeEventQuery(filters, id));
        },
        refresh() {
          clearDetailQuery();
          void controller.refresh(filters);
        },
        previousPage() {
          clearDetailQuery();
          void controller.previousPage();
        },
        nextPage() {
          clearDetailQuery();
          void controller.nextPage();
        },
        retryDetail() {
          if (query.success) void controller.openDetail(query.eventId);
        },
        selectRoot: controller.selectRoot,
        clearRoot: controller.clearRoot,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}
