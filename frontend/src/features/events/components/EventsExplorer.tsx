import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/ui/LoadingState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../../components/ui/Table";
import { useState } from "react";
import { DetailLink } from "../../../components/ui/DetailLink";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { useEvents } from "../hooks/useEvents";
import { EventFiltersForm } from "./EventFiltersForm";
import type { ApiError } from "../../../services/apiError";
import { writeEventQuery } from "../query";

import { actionLabel, requestLabel, sourceLabel } from "../presentation";
import { EventTime, EventOutcome, EventContent } from "./EventPresentation";

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
    refresh,
    previousPage,
    nextPage,
    clearRoot,
  } = useEvents();
  const [loggingIn, setLoggingIn] = useState(false);
  if (auth.status !== "authenticated")
    return <p>Vui lòng đăng nhập để xem sự kiện.</p>;
  if (workspace.status !== "ready" || !membership || !permissions.canRead)
    return <p role="status">Chọn workspace có quyền đọc để xem sự kiện.</p>;
  const hasFilters = [state.filters.source_id, state.filters.from, state.filters.to, state.filters.action, state.filters.q].some(Boolean);
  async function loginAgain() {
    setLoggingIn(true);
    try {
      await signIn();
    } finally {
      setLoggingIn(false);
    }
  }
  return (
    <section className="mt-8 space-y-4" aria-label="Danh sách sự kiện">
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
      {state.filters.q && <p className="type-body-sm text-muted">Tìm theo nội dung, mã hoạt động và mã định danh trên các nguồn được phép đọc. Khi tìm mã yêu cầu, đối chiếu mã trong từng dòng; tìm kiếm của máy chủ có thể khớp chuỗi con.</p>}
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
      <div className="events-results">
      <div className="min-w-0 space-y-4">
      {state.list.status === "loading" && <LoadingState message="Đang tải sự kiện…" variant="table" />}
      {state.list.error && (
        <>
          <Failure error={state.list.error} />
          <Button variant="secondary" type="button" onClick={refresh}>
            Bắt đầu lại từ trang đầu
          </Button>
        </>
      )}
      {state.list.status === "ready" && state.list.items.length === 0 && (
        <EmptyState title={hasFilters ? 'Không có kết quả phù hợp bộ lọc.' : state.pageIndex > 0 || state.nextCursor ? 'Trang này không có sự kiện.' : 'Chưa có sự kiện trong phạm vi được phép đọc.'}
          description={hasFilters ? 'Xóa hoặc nới bộ lọc nguồn, thời gian và từ khóa rồi tìm lại.' : 'Kiểm tra các nguồn được cấp quyền hoặc làm mới khi có log mới. Đây không phải kết luận toàn hệ thống chưa có log.'} />
      )}
      {state.list.items.length > 0 && (
        <div className="overflow-x-auto">
          <Table caption="Danh sách sự kiện" hideCaption aria-label="Danh sách sự kiện" className="w-full text-left">

            <TableHeader>
              <TableRow>
                {[
                  "Mã yêu cầu",
                  "Thời gian (UTC+7)",
                  "Nguồn xử lý",
                  "Hoạt động",
                  "Kết quả bước",
                  "Nội dung",
                ].map((label) => (
                  <TableHead scope="col" className="p-2 text-center" key={label}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.list.items.map((item) => (
                <TableRow key={item.event_id} className="border-t align-top">
                  <TableCell className="max-w-56 p-2 font-medium">
                    <DetailLink
                      label={requestLabel(item)}
                      to={`/events/${item.event_id}?${writeEventQuery(state.filters)}`}
                      accessibleLabel={`Xem sự kiện ${requestLabel(item)} — ${actionLabel(item.action)}`}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <EventTime value={item.occurred_at} />
                  </TableCell>
                  <TableCell className="max-w-56 break-words p-2">{sourceLabel(item, workspace.sources.items)}</TableCell>
                  <TableCell className="p-2">{actionLabel(item.action)}</TableCell>
                  <TableCell className="p-2"><EventOutcome outcome={item.outcome} /></TableCell>
                  <TableCell className="min-w-56 max-w-md p-2"><EventContent event={item} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <nav aria-label="Phân trang sự kiện" className="flex flex-wrap items-center justify-end gap-4">
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
      </div>
      </div>
    </section>
  );
}
