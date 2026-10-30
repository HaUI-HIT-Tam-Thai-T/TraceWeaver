import { useEffect } from "react";
import { Button } from "../../../components/ui/Button";
import { GraphTable } from "../../reconstruction/components/GraphTable";
import { LinkReviewPanel } from "../../link-review/components/LinkReviewPanel";
import { degradedLabel, runStatusLabel } from "../../reconstruction/presentation";
import type { CasesState } from "../state/state";
import type { LinkReviewActions } from "../../link-review/types";
import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";

export function CaseRunPanel({
  state,
  active,
  load,
  actions,
}: {
  state: CasesState;
  active: boolean;
  load: (force?: boolean) => Promise<void>;
  actions: LinkReviewActions;
}) {
  const status = state.caseRun.status;
  const cid = state.detail.id;
  const snapshotStatus = state.snapshot.status;
  useEffect(() => {
    if (active && status === "idle") void load();
  }, [active, status, snapshotStatus, cid, load]);
  const run = state.caseRun.run;
  const graph = state.snapshot.graph;
  const ready =
    status === "ready" &&
    run?.status === "completed" &&
    state.snapshot.status === "ready" &&
    graph?.run_id === state.detail.data?.case.run_id;
  const locked =
    state.detail.data?.case.state === "closed" || state.linkMutation.status === "locked";
  return (
    <section aria-label="Kết quả tái dựng của hồ sơ" className="space-y-4 pt-4">
      <h3 className="type-h3">Kết quả tái dựng</h3>
      {(status === "loading" || state.snapshot.status === "loading") && (
        <p role="status">Đang tải lần tái dựng đã lưu…</p>
      )}
      {state.caseRun.error && <p role="alert">{state.caseRun.error.message}</p>}
      {state.snapshot.error && <p role="alert">{state.snapshot.error.message}</p>}
      <Button
        variant="tertiary"
        disabled={
          status === "loading" ||
          state.snapshot.status === "loading" ||
          state.linkMutation.status === "sending"
        }
        onClick={() => {
          void load(true);
        }}
      >
        Tải lại kết quả tái dựng
      </Button>
      {run && (
        <>
          <p>
            Trạng thái phân tích: {runStatusLabel(run.status)}. Hoàn tất phân tích không có nghĩa
            yêu cầu nghiệp vụ đã thành công.
          </p>
          {run.degraded && <p role="status">{degradedLabel(run.degraded_reason)}</p>}
          <TechnicalDetails headingLevel={4} title="Thông tin lần tái dựng đã lưu">
            <p>
              Run: {run.id} · Snapshot: {run.input_snapshot_id}
            </p>
            <p>Lý do dự phòng gốc: {run.degraded_reason ?? "Không có"}</p>
          </TechnicalDetails>
          {run.status === "failed" && (
            <p role="alert">Phân tích thất bại; chưa có kết quả để đối chiếu.</p>
          )}
        </>
      )}
      {ready && graph && <GraphTable graph={graph} rootId={run?.root_event_id} />}
      <LinkReviewPanel
        graph={ready && graph ? graph : null}
        graphReady={ready}
        mutation={state.linkMutation}
        caseLocked={locked}
        canWrite={state.scope?.canWrite === true && !locked}
        actions={actions}
      />
    </section>
  );
}
