import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { createEventsController } from "./controller";
import { eventsService } from "../eventsService";
import { readEventLocation, readEventQuery, writeEventQuery } from "../query";
import { initialEventsState } from "./state";
import { EventsContext } from "./eventsContext";

const hiddenState = initialEventsState();

export function EventsProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const { state: workspace, membership, permissions, refreshAccess } = useWorkspace();
  const [controller] = useState(() => createEventsController(eventsService, refreshAccess));
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);

    handleChange();
    return unsubscribe;
  }, [controller]);
  const location = useLocation();
  const navigate = useNavigate();
  const eventId = matchPath("/events/:eventId", location.pathname)?.params.eventId ?? null;
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
  const visible = location.pathname === "/events" || eventId !== null;

  useEffect(() => {
    if (auth.status !== "authenticated") {
      lastScope.current = null;
      controller.stop();
      if (visible && location.search) setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }
    if (!allowed || !me || !workspaceId) {
      controller.sync(null, visible, readEventLocation(location.search, eventId));
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
      navigate("/events", { replace: true });
    } else {
      controller.sync(
        scope,
        visible,
        readEventLocation(location.search, eventId),
        eventId === null,
      );
    }
  }, [
    auth.status,
    allowed,
    me,
    workspaceId,
    permissions.canWrite,
    visible,
    location.search,
    eventId,
    navigate,
    controller,
    setSearchParams,
  ]);

  useEffect(() => {
    if (location.pathname !== "/events") return;
    const legacy = readEventQuery(location.search);
    if (legacy.success && legacy.eventId) {
      navigate(`/events/${legacy.eventId}?${writeEventQuery(legacy.filters)}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => () => controller.stop(), [controller]);

  useEffect(() => {
    if (visible && snapshot.list.error?.code === "INVALID_CURSOR") {
      const query = readEventLocation(location.search, eventId);
      if (query.success && query.eventId)
        navigate(`/events?${writeEventQuery(query.filters)}`, { replace: true });
    }
  }, [snapshot.list.error, visible, location.search, eventId, navigate]);

  const state =
    allowed && snapshot.scope?.accessKey === me && snapshot.scope.workspaceId === workspaceId
      ? snapshot
      : hiddenState;
  const query = readEventLocation(location.search, eventId);
  const filters = query.success ? query.filters : { limit: 50 };
  const clearDetailQuery = () => setSearchParams(writeEventQuery(filters));
  return (
    <EventsContext.Provider
      value={{
        state,
        setFilters(next) {
          navigate(`/events?${writeEventQuery(next)}`);
          void controller.refresh(next);
        },
        showEvent(id) {
          navigate(
            id
              ? `/events/${id}?${writeEventQuery(filters)}`
              : `/events?${writeEventQuery(filters)}`,
          );
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
