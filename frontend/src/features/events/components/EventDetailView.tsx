import { useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { useEvents } from "../hooks/useEvents";
import { SectionReveal } from "../../../components/ui/SectionReveal";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/ui/LoadingState";
import { ReconstructionPanel } from "../../reconstruction/components/ReconstructionPanel";
import { readEventLocation, writeEventQuery } from "../query";
import { actionLabel, requestLabel, requestIds, sourceLabel } from "../presentation";
import { EventTime, EventOutcome, EventContent, EventTechnicalDetails } from "./EventPresentation";
import { z } from "zod";
import type { ApiError } from "../../../services/apiError";

function Failure({ error }: { error: ApiError }) {
  return (
    <Alert variant="destructive" role="alert">
      {error.message}
      {error.requestId && <> Mã tra cứu lỗi hệ thống: {error.requestId}</>}
    </Alert>
  );
}

export function EventDetailView() {
  const { eventId } = useParams();
  const location = useLocation();
  const query = readEventLocation(location.search, eventId ?? null);
  const { state: auth, signIn } = useAuth();
  const { state: workspace, membership, permissions } = useWorkspace();
  const { state, showEvent, setFilters, selectRoot, clearRoot, retryDetail } = useEvents();
  const [loggingIn, setLoggingIn] = useState(false);
  const backToList = `/events?${writeEventQuery(state.filters)}`;
  if (!eventId || !z.uuid().safeParse(eventId).success)
    return (
      <Alert variant="destructive" role="alert">
        Mã sự kiện không hợp lệ. <Link to={backToList}>Quay lại danh sách</Link>
      </Alert>
    );
  if (auth.status !== "authenticated") return <p>Vui lòng đăng nhập để xem sự kiện.</p>;
  if (workspace.status !== "ready" || !membership || !permissions.canRead)
    return <p role="status">Chọn workspace có quyền đọc để xem sự kiện.</p>;
  // Never display the previous event while the route is being synchronized.
  const detail =
    query.success &&
    JSON.stringify(state.filters) === JSON.stringify(query.filters) &&
    state.detail.id === eventId
      ? state.detail
      : { id: eventId, status: "loading", event: null, error: null };
  const event = detail.event;
  return (
    <div className="space-y-6">
      <nav aria-label="Đường dẫn">
        <Link className="underline" to={backToList}>
          Sự kiện
        </Link>{" "}
        / Chi tiết sự kiện
      </nav>
      {state.error && <Failure error={state.error} />}
      {state.status === "invalid-query" && (
        <Alert variant="destructive" role="alert">
          Tham số URL không hợp lệ. <Link to="/events">Quay lại danh sách</Link>
        </Alert>
      )}
      {state.status === "reauth" && (
        <Button
          loading={loggingIn}
          onClick={async () => {
            setLoggingIn(true);
            try {
              await signIn();
            } finally {
              setLoggingIn(false);
            }
          }}
        >
          Đăng nhập lại
        </Button>
      )}
      {state.status === "active" && detail.id && (
        <SectionReveal className="min-w-0">
          <section aria-labelledby="event-detail-title" className="content-panel space-y-4">
            <h2 id="event-detail-title" className="text-xl font-semibold">
              Thông tin sự kiện
            </h2>
            <Button variant="secondary" type="button" onClick={() => showEvent(null)}>
              Quay lại danh sách
            </Button>
            {detail.status === "loading" && <LoadingState message="Đang tải chi tiết…" />}
            {detail.error && (
              <>
                <Failure error={detail.error} />
                <Button variant="secondary" type="button" onClick={retryDetail}>
                  Thử lại chi tiết
                </Button>
              </>
            )}
            {event && (
              <>
                <dl className="grid gap-2 break-words sm:grid-cols-[auto_1fr] sm:gap-x-6">
                  <dt className="font-medium">Mã yêu cầu</dt>
                  <dd>
                    {requestLabel(event)}
                    {requestIds(event).map((id) => (
                      <Button
                        key={id}
                        variant="ghost"
                        onClick={() => setFilters({ limit: state.filters.limit, q: id })}
                      >
                        Xem cùng mã yêu cầu {id}
                      </Button>
                    ))}
                  </dd>
                  <dt className="font-medium">Thời gian (UTC+7)</dt>
                  <dd>
                    <EventTime value={event.occurred_at} />
                  </dd>
                  <dt className="font-medium">Nguồn xử lý</dt>
                  <dd>{sourceLabel(event, workspace.sources.items)}</dd>
                  <dt className="font-medium">Hoạt động</dt>
                  <dd>{actionLabel(event.action)}</dd>
                  <dt className="font-medium">Kết quả bước</dt>
                  <dd>
                    <EventOutcome outcome={event.outcome} />
                  </dd>
                  <dt className="font-medium">Nội dung</dt>
                  <dd>
                    <EventContent event={event} />
                  </dd>
                </dl>
                <EventTechnicalDetails headingLevel={4} key={event.event_id} event={event} />
                {permissions.canWrite && (
                  <Button variant="secondary" type="button" onClick={selectRoot}>
                    Chọn làm điểm bắt đầu tái dựng
                  </Button>
                )}
              </>
            )}
          </section>
        </SectionReveal>
      )}

      {state.root?.event_id === eventId && event && state.status === "active" && (
        <>
          <Button variant="secondary" onClick={clearRoot}>
            Bỏ chọn điểm bắt đầu
          </Button>
          <ReconstructionPanel />
        </>
      )}
    </div>
  );
}
