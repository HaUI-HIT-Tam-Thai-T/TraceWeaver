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
      className="mt-6 space-y-4 border-t pt-4"
    >
      <h3 id="link-edit-title" className="text-xl font-semibold">
        Review và manual link
      </h3>
      {mutation.status === "sending" && (
        <LoadingState message="Đang gửi thao tác link…" />
      )}
      {mutation.status === "success" && (
        <p role="status">
          Đã ghi thao tác.{" "}
          {graphReady
            ? "Graph đã được tải lại."
            : "Đang chờ graph đồng bộ; nếu tải lỗi, chỉ tải lại graph."}
        </p>
      )}
      {mutation.status === "uncertain" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Chưa rõ thao tác đã được ghi hay chưa. Đã yêu cầu tải lại graph, không
          tự gửi lại POST. Kiểm tra trạng thái hiện tại trước khi quyết định
          thao tác mới.
        </Alert>
      )}
      {mutation.status === "conflict" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Link.version đã thay đổi. Giữ lý do nháp; xem trạng thái mới và chọn
          sử dụng phiên bản hiện tại trước khi gửi lại.
        </Alert>
      )}
      {mutation.status === "duplicate" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Cạnh cùng hướng đã tồn tại, kể cả khi rejected. Chọn link đó để
          review.
        </Alert>
      )}
      {caseLocked && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Run bị khóa bởi ít nhất một case closed. Reviewer cần mở lại mọi
            case closed liên quan. Tải graph không chứng minh đã mở khóa.
          </Alert>
          <Button variant="secondary"
            type="button"
            disabled={!graphReady || mutation.status === "sending"}
            onClick={actions.probeClosedCase}
          >
            Thử chỉnh sửa lại
          </Button>
          <p>
            Thao tác này chỉ cho phép gửi lần tiếp theo để BE kiểm lại; không tự
            gửi POST hoặc reopen case.
          </p>
        </>
      )}
      {mutation.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {mutation.error.code === "SELF_LINK"
            ? "Không được nối event với chính nó."
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
          Controls đang khóa tới khi graph mới được tải và xác thực thành công.
        </p>
      )}
      <form
        onSubmit={review.handleSubmit(({ link_id, ...body }) =>
          actions.reviewLink(link_id, body),
        )}
      >
        <fieldset disabled={disabled} className="space-y-2">
          <legend>Duyệt link</legend>
          <label className="type-label block" htmlFor="review-link">Link cần duyệt</label>
          <Select
            id="review-link"
            aria-invalid={!!review.formState.errors.link_id}
            {...review.register("link_id", {
              onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                chooseLink(event.target.value),
            })}
          >
            <option value="">Chọn link</option>
            {graph?.links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.from_event_id} → {link.to_event_id} ({link.review_state},
                v{link.version})
              </option>
            ))}
          </Select>
          {selected && (
            <p>
              Hướng: {selected.from_event_id} → {selected.to_event_id}. Trạng
              thái: {selected.review_state}. Link.version hiện tại:{" "}
              {selected.version}; phiên bản sẽ gửi: {expectedVersion}.
            </p>
          )}
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
          <label className="type-label block" htmlFor="review-decision">Quyết định</label>
          <Select id="review-decision" {...review.register("decision")}>
            <option value="accepted">Accept (accepted)</option>
            <option value="rejected">Reject (rejected)</option>
          </Select>
          <label className="type-label block" htmlFor="review-reason">Lý do review</label>
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
          <Button variant="primary" type="submit" disabled={!selected || stale}>
            Gửi review
          </Button>
        </fieldset>
      </form>
      <form
        onSubmit={manual.handleSubmit((body) => actions.createManualLink(body))}
      >
        <fieldset disabled={disabled} className="space-y-2">
          <legend>Đề xuất manual link</legend>
          <label className="type-label block" htmlFor="manual-from">Event nguồn</label>
          <Select
            id="manual-from"
            aria-invalid={!!manual.formState.errors.from_event_id}
            {...manual.register("from_event_id")}
          >
            <option value="">Chọn event nguồn</option>
            {graph?.nodes.map((node) => (
              <option key={node.event_id} value={node.event_id}>
                {node.event_id} — {node.action}
              </option>
            ))}
          </Select>
          <label className="type-label block" htmlFor="manual-to">Event đích</label>
          <Select
            id="manual-to"
            aria-invalid={!!manual.formState.errors.to_event_id}
            {...manual.register("to_event_id")}
          >
            <option value="">Chọn event đích</option>
            {graph?.nodes.map((node) => (
              <option key={node.event_id} value={node.event_id}>
                {node.event_id} — {node.action}
              </option>
            ))}
          </Select>
          {(manual.formState.errors.from_event_id ||
            manual.formState.errors.to_event_id) && (
            <Alert className="block break-words" variant="destructive" role="alert">
              {manual.formState.errors.to_event_id?.message ??
                "Chọn event nguồn trong graph."}
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
          <label className="type-label block" htmlFor="manual-reason">Lý do manual link</label>
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
            Cạnh mới là manual/pending, chưa được accepted và vẫn cần review.
          </p>
          <Button variant="primary" type="submit" disabled={!!duplicate}>
            Đề xuất link
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
