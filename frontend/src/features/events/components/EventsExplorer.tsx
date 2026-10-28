import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { useEvents } from "../hooks/useEvents";
import { EventFiltersForm } from "./EventFiltersForm";
import type { ApiError } from "../../../services/apiError";
import { writeEventQuery } from "../query";

export function EventTime({ value }: { value: string }) {
  return (
    <time dateTime={value} title={value}>
      {new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(value))}
      <span className="block text-xs">{value}</span>
    </time>
  );
}

function Failure({ error }: { error: ApiError }) {
  return (
    <p role="alert">
      {error.message}
      {error.requestId && <> Mã yêu cầu: {error.requestId}</>}
    </p>
  );
}

const buttonClass =
  "rounded border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

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
    return <p>Vui lòng đăng nhập để xem events.</p>;
  if (workspace.status !== "ready" || !membership || !permissions.canRead)
    return <p role="status">Chọn workspace có quyền đọc để xem events.</p>;
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
        Event explorer
      </h2>
      <EventFiltersForm />
      {state.status === "invalid-query" && (
        <p role="alert">
          Tham số URL không hợp lệ. Kiểm tra bộ lọc rồi bấm Tìm kiếm.
        </p>
      )}
      {state.error && <Failure error={state.error} />}
      {state.status === "reauth" ? (
        <button
          className={buttonClass}
          type="button"
          disabled={loggingIn}
          onClick={() => {
            void loginAgain();
          }}
        >
          Đăng nhập lại
        </button>
      ) : (
        <button className={buttonClass} type="button" onClick={refresh}>
          Làm mới snapshot
        </button>
      )}
      {state.root && (
        <div role="status" className="break-words rounded border p-3">
          Root đã chọn: {state.root.event_id} · {state.root.action}
          <button
            className={`${buttonClass} ml-3`}
            type="button"
            onClick={clearRoot}
          >
            Bỏ chọn root
          </button>
        </div>
      )}
      {state.list.status === "loading" && <p role="status">Đang tải events…</p>}
      {state.list.error && (
        <>
          <Failure error={state.list.error} />
          <button className={buttonClass} type="button" onClick={refresh}>
            Bắt đầu lại từ trang đầu
          </button>
        </>
      )}
      {state.list.status === "ready" && state.list.items.length === 0 && (
        <p role="status">Không có event phù hợp bộ lọc trong trang này.</p>
      )}
      {state.list.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="text-left">
              Events theo thứ tự backend; outcome là kết quả quan sát.
            </caption>
            <thead>
              <tr>
                {[
                  "Thời gian (UTC+7)",
                  "Nguồn / Service",
                  "Action",
                  "Outcome",
                  "Message",
                  "Chi tiết",
                ].map((label) => (
                  <th scope="col" className="p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.list.items.map((item) => (
                <tr key={item.event_id} className="border-t">
                  <td className="p-2">
                    <EventTime value={item.occurred_at} />
                  </td>
                  <td className="break-all p-2">
                    {item.source_id}
                    <br />
                    {item.service}
                  </td>
                  <td className="p-2">{item.action}</td>
                  <td className="p-2">{item.outcome}</td>
                  <td className="p-2">{item.message}</td>
                  <td className="p-2">
                    <Link
                      className="underline focus-visible:outline-2"
                      to={`/events?${writeEventQuery(state.filters, item.event_id)}`}
                      aria-label={`Xem event ${item.event_id}`}
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Phân trang events" className="flex items-center gap-3">
        <button
          className={buttonClass}
          type="button"
          disabled={
            state.pageIndex === 0 ||
            state.list.status === "loading" ||
            state.status !== "active"
          }
          onClick={previousPage}
        >
          Trước
        </button>
        <span>Trang {state.pageIndex + 1}</span>
        <button
          className={buttonClass}
          type="button"
          disabled={
            !state.nextCursor ||
            state.list.status === "loading" ||
            state.status !== "active"
          }
          onClick={nextPage}
        >
          Tiếp
        </button>
      </nav>
      {detail.id && (
        <section
          aria-labelledby="event-detail-title"
          className="space-y-3 rounded border p-4"
        >
          <h3 id="event-detail-title" className="text-xl font-semibold">
            Chi tiết event
          </h3>
          <button
            className={buttonClass}
            type="button"
            onClick={() => showEvent(null)}
          >
            Đóng chi tiết
          </button>
          {detail.status === "loading" && (
            <p role="status">Đang tải chi tiết…</p>
          )}
          {detail.error && (
            <>
              <Failure error={detail.error} />
              <button
                className={buttonClass}
                type="button"
                onClick={retryDetail}
              >
                Thử lại chi tiết
              </button>
            </>
          )}
          {event && (
            <>
              <dl className="space-y-2 break-all">
                <dt>Event ID</dt>
                <dd>{event.event_id}</dd>
                <dt>Source event ID</dt>
                <dd>{event.source_event_id}</dd>
                <dt>Thời điểm xảy ra</dt>
                <dd>
                  <EventTime value={event.occurred_at} />
                </dd>
                <dt>Thời điểm nhận</dt>
                <dd>
                  <EventTime value={event.received_at} />
                </dd>
                <dt>Action / Outcome</dt>
                <dd>
                  {event.action} / {event.outcome}
                </dd>
                <dt>Message</dt>
                <dd>{event.message}</dd>
                <dt>Parser version</dt>
                <dd>{event.parser_version}</dd>
                <dt>Batch ID</dt>
                <dd>{event.provenance.batch_id}</dd>
                <dt>Locator</dt>
                <dd>{event.provenance.locator}</dd>
                <dt>SHA-256 redacted</dt>
                <dd>{event.provenance.sha256_redacted}</dd>
              </dl>
              <h4 className="font-semibold">Identifiers</h4>
              <pre className="overflow-x-auto">
                {JSON.stringify(event.identifiers, null, 2)}
              </pre>
              <h4 className="font-semibold">Payload đã redacted</h4>
              <pre className="overflow-x-auto">
                {JSON.stringify(event.payload_redacted, null, 2)}
              </pre>
              {permissions.canWrite && (
                <button
                  className={buttonClass}
                  type="button"
                  onClick={selectRoot}
                >
                  Chọn làm root
                </button>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
