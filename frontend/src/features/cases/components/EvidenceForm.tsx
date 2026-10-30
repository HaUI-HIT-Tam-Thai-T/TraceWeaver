import { actionLabel, eventTimeLabel, requestLabel, sourceName } from "../../events/presentation";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/primitives/textarea";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { evidenceCreateSchema } from "../schemas";
import type { EvidenceCreate } from "../schemas";
import type { CaseEvidenceSnapshot, CaseEvidenceMutation } from "../state/state";

type Props = {
  snapshot: CaseEvidenceSnapshot;
  mutation: CaseEvidenceMutation;
  detailReady: boolean;
  closed: boolean;
  canWrite: boolean;
  loadSnapshot: () => Promise<void>;
  submit: (body: EvidenceCreate) => Promise<void>;
  beginNew: () => void;
};
export function EvidenceForm(props: Props) {
  return props.canWrite ? <EditableEvidenceForm {...props} /> : null;
}
function EditableEvidenceForm({
  snapshot,
  mutation,
  detailReady,
  closed,
  loadSnapshot,
  submit,
  beginNew,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EvidenceCreate>({
    resolver: zodResolver(evidenceCreateSchema),
    defaultValues: { kind: "note", event_ids: [], note: "" },
  });
  const kind = useWatch({ control, name: "kind" });
  const selected = useWatch({ control, name: "event_ids" });
  useEffect(() => {
    if (kind === "note") setValue("event_ids", []);
  }, [kind, setValue]);
  useEffect(() => {
    if (kind === "events" && snapshot.status === "idle" && detailReady && !closed)
      void loadSnapshot();
  }, [kind, snapshot.status, detailReady, closed, loadSnapshot]);
  useEffect(() => {
    if (mutation.status === "success" && mutation.savedId)
      reset({ kind: "note", event_ids: [], note: "" });
  }, [mutation.status, mutation.savedId, reset]);
  const disabled =
    !detailReady || closed || ["sending", "uncertain", "locked"].includes(mutation.status);
  const snapshotReady = kind === "note" || snapshot.status === "ready";
  return (
    <section className="mt-6 space-y-3 border-t pt-4" aria-labelledby="add-evidence-title">
      <h2 id="add-evidence-title" className="text-xl font-semibold">
        Thêm bằng chứng hoặc ghi chú
      </h2>
      <p>
        Chọn sự kiện trong ảnh chụp dữ liệu của lần tái dựng gắn với hồ sơ này, hoặc lưu ghi chú xử
        lý. Bằng chứng đã lưu được giữ trong lịch sử; phiên bản trạng thái do hệ thống quản lý.
      </p>
      {closed && (
        <p role="status">
          Hồ sơ đã đóng: chỉ được xem. Nhờ người có quyền xác minh mở lại hồ sơ nếu cần bổ sung bằng
          chứng.
        </p>
      )}
      {mutation.status === "sending" && <LoadingState message="Đang lưu bằng chứng…" />}
      {mutation.status === "success" && (
        <p role="status">
          Đã lưu bằng chứng.{" "}
          {detailReady
            ? "Thông tin hồ sơ đã được tải lại."
            : "Chưa tải được thông tin mới; hãy tải lại hồ sơ thay vì gửi thêm bằng chứng."}
        </p>
      )}
      {mutation.status === "uncertain" && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Chưa rõ bằng chứng đã lưu hay chưa. Hệ thống đang tải lại hồ sơ và không tự gửi lại thao
            tác. Nội dung trùng với bằng chứng có sẵn không chứng minh lần gửi này đã thành công.
          </Alert>
          <Button
            variant="secondary"
            type="button"
            disabled={!detailReady || closed}
            onClick={beginNew}
          >
            Bắt đầu thêm bằng chứng mới
          </Button>
          <p>
            Chỉ bấm sau khi kiểm tra hồ sơ. Gửi tiếp có thể tạo bằng chứng trùng; nháp hiện tại được
            giữ.
          </p>
        </>
      )}
      {mutation.status === "locked" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          Hồ sơ đã đóng (CASE_CLOSED): form đã khóa. Tải lại hồ sơ và nhờ người có quyền xác minh
          kiểm tra việc mở lại.
        </Alert>
      )}
      {mutation.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {mutation.error.message}{" "}
          {mutation.error.requestId && <>Request ID: {mutation.error.requestId}</>}
        </Alert>
      )}
      {!detailReady && (
        <p role="status">
          Đợi thông tin hồ sơ mới tải xong trước khi gửi. Nội dung đang nhập vẫn được giữ.
        </p>
      )}
      <form
        onSubmit={handleSubmit((value) =>
          submit({
            ...value,
            event_ids: value.kind === "note" ? [] : value.event_ids,
          }),
        )}
      >
        <fieldset disabled={disabled} className="space-y-3">
          <legend>Nội dung bằng chứng</legend>
          <label className="type-label block" htmlFor="evidence-kind">
            Loại bằng chứng
          </label>
          <Select id="evidence-kind" {...register("kind")}>
            <option value="note">Ghi chú</option>
            <option value="events">Sự kiện trong ảnh chụp dữ liệu</option>
          </Select>
          {kind === "events" && (
            <fieldset>
              <legend>Chọn sự kiện đã ghi nhận (tối đa 1.000)</legend>
              {snapshot.status === "loading" && (
                <LoadingState message="Đang tải sự kiện của lần tái dựng…" />
              )}
              {snapshot.status === "error" && (
                <>
                  <Alert className="block break-words" variant="destructive" role="alert">
                    {snapshot.error?.message}{" "}
                    {snapshot.error?.requestId && <>Request ID: {snapshot.error.requestId}</>}
                  </Alert>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      void loadSnapshot();
                    }}
                  >
                    Tải lại sự kiện
                  </Button>
                </>
              )}
              {snapshot.status === "ready" && snapshot.events.length === 0 && (
                <p>Lần tái dựng này không có sự kiện để chọn.</p>
              )}
              {snapshot.status === "ready" &&
                snapshot.events.map((event) => (
                  <label className="type-label block" key={event.event_id}>
                    <input
                      type="checkbox"
                      className="mr-2 size-4 align-middle accent-primary"
                      value={event.event_id}
                      {...register("event_ids")}
                    />
                    {actionLabel(event.action)} · {requestLabel(event)} ·{" "}
                    {sourceName(event.service)} · {eventTimeLabel(event.occurred_at)}
                  </label>
                ))}
              <p>Đã chọn {selected.length} sự kiện.</p>
              {errors.event_ids && (
                <Alert className="block break-words" variant="destructive" role="alert">
                  {errors.event_ids.message}
                </Alert>
              )}
            </fieldset>
          )}
          <label className="type-label block" htmlFor="evidence-note">
            Ghi chú (tối đa 10.000 ký tự; có thể rỗng khi chọn sự kiện)
          </label>
          <Textarea
            id="evidence-note"
            aria-invalid={!!errors.note}
            aria-describedby={errors.note ? "evidence-note-error" : undefined}
            {...register("note")}
          />
          {errors.note && (
            <Alert
              className="block break-words"
              variant="destructive"
              id="evidence-note-error"
              role="alert"
            >
              {errors.note.message}
            </Alert>
          )}
          <Button variant="primary" type="submit" disabled={!snapshotReady}>
            Lưu bằng chứng
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
