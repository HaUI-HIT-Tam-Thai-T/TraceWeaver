import type { ReconstructionState } from "./state";
import { GraphTable } from "./GraphTable";

export function RunResult({
  state,
  retry,
  track,
  loadGraph,
  signIn,
}: {
  state: ReconstructionState;
  retry: () => void;
  track: () => void;
  loadGraph: () => void;
  signIn: () => void;
}) {
  const { run, error } = state;
  const runErrorCode =
    run?.error?.code && /^[A-Z][A-Z0-9_]{0,99}$/.test(run.error.code)
      ? run.error.code
      : "RUN_FAILED";
  return (
    <div className="space-y-3" aria-live="polite">
      {state.phase === "validating" && (
        <p role="status">Đang xác minh root và quyền truy cập…</p>
      )}
      {state.phase === "sending" && (
        <p role="status">Đang gửi thao tác tạo run…</p>
      )}
      {state.phase === "uncertain" && (
        <>
          <p role="alert">
            Chưa rõ kết quả thao tác. Run có thể đã được tạo; gửi lại sẽ dùng
            cùng body và Idempotency-Key.
          </p>
          <button type="button" onClick={retry}>
            Gửi lại thao tác
          </button>
        </>
      )}
      {error && (
        <p role="alert">
          {error.code === "WINDOW_TOO_LARGE"
            ? "Window hoặc số event vượt giới hạn. Thu hẹp thời gian hoặc nguồn; không cắt dữ liệu ở FE."
            : error.message}{" "}
          {error.requestId && <>Request ID: {error.requestId}</>}
        </p>
      )}
      {state.phase === "reauth" && (
        <button type="button" onClick={signIn}>
          Đăng nhập lại
        </button>
      )}
      {run && (
        <>
          <h3 className="text-xl font-semibold">Run {run.id}</h3>
          <p>
            Trạng thái: {run.status}. Yêu cầu: {run.mode}. Phương pháp thực tế:{" "}
            {run.effective_method}.
          </p>
          <p>
            Snapshot: {run.input_snapshot_id}; rule: {run.rule_version}; model:{" "}
            {run.model_version ?? "không có"}.
          </p>
          {run.degraded && (
            <p role="status">
              {run.degraded_reason === "ai_unavailable"
                ? "AI chưa sẵn sàng, kết quả dùng luật"
                : "Kết quả sử dụng phương pháp suy giảm so với yêu cầu."}
            </p>
          )}
          {run.status === "failed" && (
            <p role="alert">
              Run thất bại. Mã: {runErrorCode}. Không có graph để hiển thị.
            </p>
          )}
          {(state.tracking === "loading" || state.tracking === "waiting") && (
            <p role="status">Đang theo dõi run…</p>
          )}
          {(state.tracking === "paused" || state.tracking === "error") && (
            <>
              <p>
                Theo dõi đã dừng; trạng thái cuối không phải kết luận run thất
                bại.
              </p>
              <button type="button" onClick={track}>
                Kiểm tra tiếp trạng thái
              </button>
            </>
          )}
        </>
      )}
      {state.graphStatus === "loading" && <p role="status">Đang tải graph…</p>}
      {state.graphStatus === "error" && (
        <button type="button" onClick={loadGraph}>
          Tải lại graph
        </button>
      )}
      {state.graph && <GraphTable graph={state.graph} />}
    </div>
  );
}
