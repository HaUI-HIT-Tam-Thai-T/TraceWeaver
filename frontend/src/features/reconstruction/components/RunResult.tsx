import { LoadingState } from "../../../components/ui/LoadingState";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import type { ReconstructionState } from "../state/state";
import { GraphTable } from "./GraphTable";
import { LinkReviewPanel } from "../../link-review/components/LinkReviewPanel";
import type { LinkReviewActions } from "../../link-review/types";

export function RunResult({
  state,
  retry,
  track,
  loadGraph,
  signIn,
  linkActions,
  canWrite = false,
}: {
  state: ReconstructionState;
  retry: () => void;
  track: () => void;
  loadGraph: () => void;
  signIn: () => void;
  linkActions?: LinkReviewActions;
  canWrite?: boolean;
}) {
  const { run, error } = state;
  const runErrorCode =
    run?.error?.code && /^[A-Z][A-Z0-9_]{0,99}$/.test(run.error.code)
      ? run.error.code
      : "RUN_FAILED";
  return (
    <div className="space-y-3" aria-live="polite">
      {state.phase === "validating" && (
        <LoadingState message="Đang xác minh root và quyền truy cập…" />
      )}
      {state.phase === "sending" && (
        <LoadingState message="Đang gửi thao tác tạo run…" />
      )}
      {state.phase === "uncertain" && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Chưa rõ kết quả thao tác. Run có thể đã được tạo; gửi lại sẽ dùng
            cùng body và Idempotency-Key.
          </Alert>
          <Button variant="secondary" type="button" onClick={retry}>
            Gửi lại thao tác
          </Button>
        </>
      )}
      {error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {error.code === "WINDOW_TOO_LARGE"
            ? "Window hoặc số event vượt giới hạn. Thu hẹp thời gian hoặc nguồn; không cắt dữ liệu ở FE."
            : error.message}{" "}
          {error.requestId && <>Request ID: {error.requestId}</>}
        </Alert>
      )}
      {state.phase === "reauth" && (
        <Button variant="secondary" type="button" onClick={signIn}>
          Đăng nhập lại
        </Button>
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
            <Alert className="block break-words" variant="destructive" role="alert">
              Run thất bại. Mã: {runErrorCode}. Không có graph để hiển thị.
            </Alert>
          )}
          {(state.tracking === "loading" || state.tracking === "waiting") && (
            <LoadingState message="Đang theo dõi run…" />
          )}
          {(state.tracking === "paused" || state.tracking === "error") && (
            <>
              <p>
                Theo dõi đã dừng; trạng thái cuối không phải kết luận run thất
                bại.
              </p>
              <Button variant="secondary" type="button" onClick={track}>
                Kiểm tra tiếp trạng thái
              </Button>
            </>
          )}
        </>
      )}
      {state.graphStatus === "loading" && <LoadingState message="Đang tải graph…" />}
      {state.graphStatus === "error" && (
        <Button variant="secondary" type="button" onClick={loadGraph}>
          Tải lại graph
        </Button>
      )}
      {state.graph && state.graphStatus === "ready" && (
        <GraphTable graph={state.graph} />
      )}
      {state.run?.status === "completed" && linkActions && (
        <LinkReviewPanel
          graph={state.graph}
          graphReady={state.graphStatus === "ready"}
          mutation={state.mutation}
          caseLocked={state.caseLocked}
          canWrite={canWrite}
          actions={linkActions}
        />
      )}
    </div>
  );
}
