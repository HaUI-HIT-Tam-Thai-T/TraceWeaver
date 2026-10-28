import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/ui/LoadingState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../../components/ui/Table";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { useEvents } from "../hooks/useEvents";
import { EventFiltersForm } from "./EventFiltersForm";
import type { ApiError } from "../../../services/apiError";
import { writeEventQuery } from "../query";

import { actionLabel, requestLabel, sourceLabel } from "../presentation";
import { EventTime, EventOutcome, EventContent, EventTechnicalDetails } from "./EventPresentation";

function Failure({ error }: { error: ApiError }) {
  return (
    <Alert className="block break-words" variant="destructive" role="alert">
      {error.message}
      {error.requestId && <> Mã tra cứu lỗi hệ thống: {error.requestId}</>}
    </Alert>
  );
}


export function EventsExplorer() {
  const { state: auth, signIn } = useAuth();
  const { state: workspace, membership, permissions } = useWorkspace();
  const {
    state,
    showEvent,
    refresh,
    previousPage,
    nextPage,
    selectRoot,
    clearRoot,
    retryDetail,
  } = useEvents();
  const [loggingIn, setLoggingIn] = useState(false);
  if (auth.status !== "authenticated")
    return <p>Vui lòng đăng nhập để xem sự kiện.</p>;
  if (workspace.status !== "ready" || !membership || !permissions.canRead)
    return <p role="status">Chọn workspace có quyền đọc để xem sự kiện.</p>;
  const detail = state.detail;
  const event = detail.event;
  async function loginAgain() {
    setLoggingIn(true);
    try {
      await signIn();
    } finally {
      setLoggingIn(false);
    }
  }
  return (
    <section className="mt-8 space-y-4" aria-labelledby="events-title">
      <h2 id="events-title" className="text-2xl font-semibold">
        Sự kiện
      </h2>
      <EventFiltersForm />
      {state.status === "invalid-query" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Tham số URL không hợp lệ. Kiểm tra bộ lọc rồi bấm Tìm kiếm.
        </Alert>
      )}
      {state.error && <Failure error={state.error} />}
      {state.status === "reauth" ? (
        <Button variant="secondary"
          type="button"
          disabled={loggingIn}
          onClick={() => {
            void loginAgain();
          }}
        >
          Đăng nhập lại
        </Button>
      ) : (
        <Button variant="secondary" type="button" onClick={refresh}>
          Làm mới danh sách
        </Button>
      )}
      {state.root && (
        <div role="status" className="break-words rounded border p-3">
          Điểm bắt đầu tái dựng: {requestLabel(state.root)} · {actionLabel(state.root.action)}
          <Button variant="secondary"
            className="ml-3"
            type="button"
            onClick={clearRoot}
          >
            Bỏ chọn điểm bắt đầu
          </Button>
        </div>
      )}
      {state.list.status === "loading" && <LoadingState message="Đang tải sự kiện…" />}
      {state.list.error && (
        <>
          <Failure error={state.list.error} />
          <Button variant="secondary" type="button" onClick={refresh}>
            Bắt đầu lại từ trang đầu
          </Button>
        </>
      )}
      {state.list.status === "ready" && state.list.items.length === 0 && (
        <EmptyState title="Không có sự kiện phù hợp bộ lọc trong trang này." />
      )}
      {state.list.items.length > 0 && (
        <div className="overflow-x-auto">
          <Table caption="Kết quả từng bước đã ghi nhận; không phải kết luận cho toàn bộ yêu cầu." className="w-full text-left">

            <TableHeader>
              <TableRow>
                {[
                  "Mã yêu cầu",
                  "Thời gian (UTC+7)",
                  "Nguồn xử lý",
                  "Hoạt động",
                  "Kết quả bước",
                  "Nội dung",
                  "Chi tiết",
                ].map((label) => (
                  <TableHead scope="col" className="p-2" key={label}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.list.items.map((item) => (
                <TableRow key={item.event_id} className="border-t align-top">
                  <TableCell className="max-w-56 break-words p-2 font-medium">{requestLabel(item)}</TableCell>
                  <TableCell className="p-2">
                    <EventTime value={item.occurred_at} />
                  </TableCell>
                  <TableCell className="max-w-56 break-words p-2">{sourceLabel(item, workspace.sources.items)}</TableCell>
                  <TableCell className="p-2">{actionLabel(item.action)}</TableCell>
                  <TableCell className="p-2"><EventOutcome outcome={item.outcome} /></TableCell>
                  <TableCell className="min-w-56 max-w-md p-2"><EventContent event={item} /></TableCell>
                  <TableCell className="p-2">
                    <Link
                      className="underline focus-visible:outline-2"
                      to={`/events?${writeEventQuery(state.filters, item.event_id)}`}
                      aria-label={`Xem sự kiện ${requestLabel(item)} — ${actionLabel(item.action)}`}
                    >
                      Xem
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <nav aria-label="Phân trang sự kiện" className="flex items-center gap-3">
        <Button variant="secondary"
          type="button"
          disabled={
            state.pageIndex === 0 ||
            state.list.status === "loading" ||
            state.status !== "active"
          }
          onClick={previousPage}
        >
          Trước
        </Button>
        <span>Trang {state.pageIndex + 1}</span>
        <Button variant="secondary"
          type="button"
          disabled={
            !state.nextCursor ||
            state.list.status === "loading" ||
            state.status !== "active"
          }
          onClick={nextPage}
        >
          Tiếp
        </Button>
      </nav>
      {detail.id && (
        <section
          aria-labelledby="event-detail-title"
          className="space-y-3 rounded border p-4"
        >
          <h3 id="event-detail-title" className="text-xl font-semibold">
            Chi tiết sự kiện
          </h3>
          <Button variant="secondary"
              type="button"
            onClick={() => showEvent(null)}
          >
            Đóng chi tiết
          </Button>
          {detail.status === "loading" && (
            <LoadingState message="Đang tải chi tiết…" />
          )}
          {detail.error && (
            <>
              <Failure error={detail.error} />
              <Button variant="secondary"
                      type="button"
                onClick={retryDetail}
              >
                Thử lại chi tiết
              </Button>
            </>
          )}
          {event && (
            <>
              <dl className="grid gap-2 break-words sm:grid-cols-[auto_1fr] sm:gap-x-6">
                <dt className="font-medium">Mã yêu cầu</dt>
                <dd>{requestLabel(event)}</dd>
                <dt className="font-medium">Thời gian (UTC+7)</dt>
                <dd><EventTime value={event.occurred_at} /></dd>
                <dt className="font-medium">Nguồn xử lý</dt>
                <dd>{sourceLabel(event, workspace.sources.items)}</dd>
                <dt className="font-medium">Hoạt động</dt>
                <dd>{actionLabel(event.action)}</dd>
                <dt className="font-medium">Kết quả bước</dt>
                <dd><EventOutcome outcome={event.outcome} /></dd>
                <dt className="font-medium">Nội dung</dt>
                <dd><EventContent event={event} /></dd>
              </dl>
              <EventTechnicalDetails key={event.event_id} event={event} />
              {permissions.canWrite && (
                <Button variant="secondary"
                          type="button"
                  onClick={selectRoot}
                >
                  Chọn làm điểm bắt đầu tái dựng
                </Button>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
