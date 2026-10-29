import { graphStepLabels, reviewLabel, scoreExplanation, evidenceLabel } from "../../reconstruction/presentation";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/primitives/textarea";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Graph } from "../../reconstruction/schemas";
import { manualLinkCreateSchema, reviewFormSchema } from "../schemas";
import type { ManualLinkCreate, ReviewFormValues } from "../schemas";
import type { LinkMutation, LinkReviewActions } from "../types";

type Props = {
  graph: Graph | null;
  graphReady: boolean;
  mutation: LinkMutation;
  caseLocked: boolean;
  canWrite: boolean;
  actions: LinkReviewActions;
};
export function LinkReviewPanel(props: Props) {
  return props.canWrite ? <LinkForms {...props} /> : null;
}
function LinkForms({
  graph,
  graphReady,
  mutation,
  caseLocked,
  actions,
}: Props) {
  const review = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      link_id: "",
      decision: "accepted",
      reason: "",
      expected_version: 0,
    },
  });
  const manual = useForm<ManualLinkCreate>({
    resolver: zodResolver(manualLinkCreateSchema),
    defaultValues: { from_event_id: "", to_event_id: "", reason: "" },
  });
  const selectedId = useWatch({ control: review.control, name: "link_id" });
  const expectedVersion = useWatch({
    control: review.control,
    name: "expected_version",
  });
  const labels: { [id: string]: string | undefined } = graph ? graphStepLabels(graph) : {};
  function stepLabel(id: string) { return labels[id] ?? 'Sự kiện không có trong ảnh chụp dữ liệu'; }
  const selected = graph?.links.find((link) => link.id === selectedId);
  const from = useWatch({ control: manual.control, name: "from_event_id" });
  const to = useWatch({ control: manual.control, name: "to_event_id" });
  const duplicate = graph?.links.find(
    (link) => link.from_event_id === from && link.to_event_id === to,
  );
  const disabled = !graphReady || caseLocked || mutation.status === "sending";
  const [acknowledgedConflict, setAcknowledgedConflict] =
    useState<LinkMutation | null>(null);
  const stale =
    selected !== undefined &&
    (expectedVersion !== selected.version ||
      (mutation.status === "conflict" && acknowledgedConflict !== mutation));
  const { setValue: setReviewValue } = review;
  const { setValue: setManualValue } = manual;
  useEffect(() => {
    if (mutation.status === "success") {
      if (mutation.linkId) setReviewValue("reason", "");
      else setManualValue("reason", "");
    }
  }, [mutation.status, mutation.linkId, setReviewValue, setManualValue]);
  function chooseLink(id: string) {
    const link = graph?.links.find((link) => link.id === id);
    review.setValue("link_id", id, { shouldValidate: true });
    review.setValue("expected_version", link?.version ?? 0);
    setAcknowledgedConflict(mutation);
  }
  return (
    <section
      aria-labelledby="link-edit-title"
      className="link-review-layout mt-6 space-y-4 border-t border-line pt-6"
    >
      <h3 id="link-edit-title" className="text-xl font-semibold">
        Duyệt và đề xuất liên kết
      </h3>
      {mutation.status === "sending" && (
        <LoadingState message="Đang gửi quyết định liên kết…" />
      )}
      {mutation.status === "success" && (
        <p role="status">
          Đã ghi thao tác.{" "}
          {graphReady
            ? "Kết quả liên kết đã được tải lại."
            : "Đang tải kết quả mới; nếu tải lỗi, hãy tải lại thay vì gửi lại quyết định."}
        </p>
      )}
      {mutation.status === "uncertain" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Chưa rõ thao tác đã được ghi hay chưa. Đã yêu cầu tải lại kết quả và không tự gửi lại thao tác. Kiểm tra trạng thái hiện tại trước khi quyết định
          thao tác mới.
        </Alert>
      )}
      {mutation.status === "conflict" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Liên kết đã được người khác cập nhật. Giữ lý do nháp; xem trạng thái mới và chọn
          sử dụng phiên bản hiện tại trước khi gửi lại.
        </Alert>
      )}
      {mutation.status === "duplicate" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Liên kết cùng hướng đã tồn tại, kể cả khi từng bị từ chối. Hãy chọn liên kết đó để duyệt.
        </Alert>
      )}
      {caseLocked && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Kết quả đang bị khóa vì có hồ sơ liên quan đã đóng. Người xác minh cần kiểm tra và mở lại các hồ sơ đó trước khi chỉnh sửa. Tải lại kết quả không tự mở khóa.
          </Alert>
          <Button variant="secondary"
            type="button"
            disabled={!graphReady || mutation.status === "sending"}
            onClick={actions.probeClosedCase}
          >
            Thử chỉnh sửa lại
          </Button>
          <p>
            Sau khi hồ sơ được mở lại, bấm nút này để cho phép chỉnh sửa lần tiếp theo. Hệ thống sẽ kiểm tra lại khóa khi bạn gửi; thao tác này không tự mở lại hồ sơ.
          </p>
        </>
      )}
      {mutation.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {mutation.error.code === "SELF_LINK"
            ? "Không được nối một sự kiện với chính nó."
            : mutation.error.code === "LINK_CYCLE"
              ? "Cạnh tạo chu trình; hãy kiểm tra và sửa đề xuất."
              : mutation.error.message}{" "}
          {mutation.error.requestId && (
            <>Request ID: {mutation.error.requestId}</>
          )}
        </Alert>
      )}
      {!graphReady && (
        <p role="status">
          Vui lòng chờ kết quả mới tải xong trước khi chỉnh sửa.
        </p>
      )}
      <form
        onSubmit={review.handleSubmit(({ link_id, ...body }) =>
          actions.reviewLink(link_id, body),
        )}
      >
        <fieldset disabled={disabled} className="space-y-2">
          <legend>Duyệt liên kết</legend>
          <label className="type-label block" htmlFor="review-link">Liên kết cần duyệt</label>
          <Select
            id="review-link"
            aria-invalid={!!review.formState.errors.link_id}
            {...review.register("link_id", {
              onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                chooseLink(event.target.value),
            })}
          >
            <option value="">Chọn liên kết</option>
            {graph?.links.map((link) => (
              <option key={link.id} value={link.id}>
                {stepLabel(link.from_event_id)} → {stepLabel(link.to_event_id)} ({reviewLabel(link.review_state)})
              </option>
            ))}
          </Select>
          {selected && graph && <article className="rounded-md border border-line p-4 space-y-2">
            <p>{stepLabel(selected.from_event_id)} → {stepLabel(selected.to_event_id)}</p>
            <p>{reviewLabel(selected.review_state)}. {scoreExplanation(selected)}</p>
            <p>Bằng chứng đối chiếu: {selected.evidence.map(entry => `${evidenceLabel(entry.reason_code)}: ${entry.field} = ${JSON.stringify(entry.observed_values)}`).join('; ') || 'Chưa có bằng chứng'}</p>
            <details><summary>Phiên bản đang duyệt</summary><p>Link.version hiện tại: {selected.version}; phiên bản sẽ gửi: {expectedVersion}.</p></details>
          </article>}
          {stale && (
            <Button variant="secondary"
              type="button"
              onClick={() => {
                review.setValue("expected_version", selected.version, {
                  shouldValidate: true,
                });
                setAcknowledgedConflict(mutation);
              }}
            >
              Sử dụng phiên bản hiện tại
            </Button>
          )}
          {(review.formState.errors.link_id ||
            review.formState.errors.expected_version) && (
            <Alert className="block break-words" variant="destructive" role="alert">Chọn link và phiên bản hợp lệ.</Alert>
          )}
          <input type="hidden" {...review.register('decision')} />
          <p>Quyết định: đọc bằng chứng, nhập lý do rồi chọn chấp nhận hoặc từ chối bên dưới.</p>
          <label className="type-label block" htmlFor="review-reason">Lý do quyết định</label>
          <Textarea
            id="review-reason"
            aria-invalid={!!review.formState.errors.reason}
            aria-describedby={
              review.formState.errors.reason ? "review-reason-error" : undefined
            }
            {...review.register("reason")}
          />
          {review.formState.errors.reason && (
            <Alert className="block break-words" variant="destructive" id="review-reason-error" role="alert">
              {review.formState.errors.reason.message}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" type="submit" disabled={!selected || stale} onClick={() => review.setValue('decision', 'accepted')}>Chấp nhận liên kết</Button>
            <Button variant="danger" type="submit" disabled={!selected || stale} onClick={() => review.setValue('decision', 'rejected')}>Từ chối liên kết</Button>
          </div>
        </fieldset>
      </form>
      <form
        onSubmit={manual.handleSubmit((body) => actions.createManualLink(body))}
      >
        <fieldset disabled={disabled} className="space-y-2">
          <legend>Đề xuất liên kết thủ công</legend>
          <label className="type-label block" htmlFor="manual-from">Bước nguồn</label>
          <Select
            id="manual-from"
            aria-invalid={!!manual.formState.errors.from_event_id}
            {...manual.register("from_event_id")}
          >
            <option value="">Chọn bước nguồn</option>
            {graph?.nodes.map((node) => (
              <option key={node.event_id} value={node.event_id}>
                {stepLabel(node.event_id)}
              </option>
            ))}
          </Select>
          <label className="type-label block" htmlFor="manual-to">Bước đích</label>
          <Select
            id="manual-to"
            aria-invalid={!!manual.formState.errors.to_event_id}
            {...manual.register("to_event_id")}
          >
            <option value="">Chọn bước đích</option>
            {graph?.nodes.map((node) => (
              <option key={node.event_id} value={node.event_id}>
                {stepLabel(node.event_id)}
              </option>
            ))}
          </Select>
          {(manual.formState.errors.from_event_id ||
            manual.formState.errors.to_event_id) && (
            <Alert className="block break-words" variant="destructive" role="alert">
              {manual.formState.errors.to_event_id?.message ??
                "Chọn bước nguồn trong graph."}
            </Alert>
          )}
          {duplicate && (
            <p>
              Cạnh này đã tồn tại: {duplicate.review_state}.{" "}
              <Button variant="secondary" type="button" onClick={() => chooseLink(duplicate.id)}>
                Chọn cạnh có sẵn để review
              </Button>
            </p>
          )}
          <label className="type-label block" htmlFor="manual-reason">Lý do đề xuất</label>
          <Textarea
            id="manual-reason"
            aria-invalid={!!manual.formState.errors.reason}
            aria-describedby={
              manual.formState.errors.reason ? "manual-reason-error" : undefined
            }
            {...manual.register("reason")}
          />
          {manual.formState.errors.reason && (
            <Alert className="block break-words" variant="destructive" id="manual-reason-error" role="alert">
              {manual.formState.errors.reason.message}
            </Alert>
          )}
          <p>
            Liên kết thủ công mới sẽ ở trạng thái chờ duyệt; cần kiểm tra bằng chứng trước khi chấp nhận.
          </p>
          <Button variant="primary" type="submit" disabled={!!duplicate}>
            Đề xuất liên kết
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
