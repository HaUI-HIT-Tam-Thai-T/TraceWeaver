import { degradedLabel } from '../presentation';
import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";
import { modeLabel, runStatusLabel } from "../presentation";
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
        <LoadingState message="Đang kiểm tra sự kiện bắt đầu và quyền truy cập…" />
      )}
      {state.phase === "sending" && (
        <LoadingState message="Đang yêu cầu tái dựng…" />
      )}
      {state.phase === "uncertain" && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Chưa rõ yêu cầu đã được xử lý hay chưa. Gửi lại thao tác này sẽ dùng mã chống trùng và nội dung cũ; không sửa phạm vi trước khi gửi lại.
          </Alert>
          <Button variant="secondary" type="button" onClick={retry}>
            Gửi lại thao tác
          </Button>
        </>
      )}
      {error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {error.code === "WINDOW_TOO_LARGE"
            ? "Phạm vi thời gian hoặc số sự kiện vượt giới hạn. Thu hẹp thời gian hoặc bớt nguồn rồi bắt đầu thao tác mới."
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
        <section className="result-summary space-y-4" aria-label="Tóm tắt kết quả tái dựng">
          <h3 className="text-xl font-semibold">Kết quả tái dựng</h3>
          <p>
            Trạng thái: {runStatusLabel(run.status)}. Yêu cầu: {modeLabel(run.mode)}. Phương pháp thực tế:{" "}
            {modeLabel(run.effective_method)}.
          </p>
          <TechnicalDetails headingLevel={4} title="Thông tin kỹ thuật của lần tái dựng"><p>Run: {run.id}</p><p>
            Snapshot: {run.input_snapshot_id}; rule: {run.rule_version}; model:{" "}
            {run.model_version ?? "không có"}.
          </p><p>Lý do dự phòng gốc: {run.degraded_reason ?? 'Không có'}</p></TechnicalDetails>
          {run.degraded && (
            <p role="status">
              {degradedLabel(run.degraded_reason)}
            </p>
          )}
          {run.status === "failed" && (
            <Alert className="block break-words" variant="destructive" role="alert">
              Tái dựng thất bại. Hãy kiểm tra phạm vi nguồn và thử lại bằng một thao tác mới. Mã: {runErrorCode}. Chưa có kết quả để hiển thị; đây không phải kết luận thiếu log.
            </Alert>
          )}
          {(state.tracking === "loading" || state.tracking === "waiting") && (
            <LoadingState message="Đang theo dõi tiến trình tái dựng…" />
          )}
          {(state.tracking === "paused" || state.tracking === "error") && (
            <>
              <p>
                Đã dừng chờ cập nhật. Tác vụ vẫn có thể đang xử lý; bấm kiểm tra tiếp để xem kết quả mới.
              </p>
              <Button variant="secondary" type="button" onClick={track}>
                Kiểm tra tiếp trạng thái
              </Button>
            </>
          )}
        </section>
      )}
      {state.graphStatus === "loading" && <LoadingState message="Đang tải kết quả liên kết…" />}
      {state.graphStatus === "error" && (
        <Button variant="secondary" type="button" onClick={loadGraph}>
          Tải lại kết quả liên kết
        </Button>
      )}
      {state.graph && state.graphStatus === "ready" && (
        <GraphTable graph={state.graph} rootId={run?.root_event_id} />
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
