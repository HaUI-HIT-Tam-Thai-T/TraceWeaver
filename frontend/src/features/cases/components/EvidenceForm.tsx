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
import type {
  CaseEvidenceSnapshot,
  CaseEvidenceMutation,
} from "../state/state";

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
    if (
      kind === "events" &&
      snapshot.status === "idle" &&
      detailReady &&
      !closed
    )
      void loadSnapshot();
  }, [kind, snapshot.status, detailReady, closed, loadSnapshot]);
  useEffect(() => {
    if (mutation.status === "success" && mutation.savedId)
      reset({ kind: "note", event_ids: [], note: "" });
  }, [mutation.status, mutation.savedId, reset]);
  const disabled =
    !detailReady ||
    closed ||
    ["sending", "uncertain", "locked"].includes(mutation.status);
  const snapshotReady = kind === "note" || snapshot.status === "ready";
  return (
    <section
      className="mt-6 space-y-3 border-t pt-4"
      aria-labelledby="add-evidence-title"
    >
      <h3 id="add-evidence-title" className="text-xl font-semibold">
        Thêm evidence hoặc note
      </h3>
      <p>
        Chỉ tham chiếu events thuộc snapshot của run trong case. Evidence là
        append-only; FE không tự tăng Case.version.
      </p>
      {closed && (
        <p role="status">
          Case closed: chỉ đọc. Cần reviewer xử lý workflow để mở lại; form
          không tự gọi reopen.
        </p>
      )}
      {mutation.status === "sending" && <LoadingState message="Đang gửi evidence…" />}
      {mutation.status === "success" && (
        <p role="status">
          Đã lưu evidence.{" "}
          {detailReady
            ? "Đã đọc lại detail từ BE."
            : "Chưa đồng bộ được detail; nếu GET lỗi, chỉ tải lại detail."}
        </p>
      )}
      {mutation.status === "uncertain" && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Chưa rõ POST đã được ghi hay chưa. Đã yêu cầu đọc lại detail, không
            tự gửi lại POST. Evidence trùng nội dung không chứng minh thao tác
            này thành công.
          </Alert>
          <Button variant="secondary"
            type="button"
            disabled={!detailReady || closed}
            onClick={beginNew}
          >
            Bắt đầu thao tác evidence mới
          </Button>
          <p>
            Chỉ bấm sau khi kiểm tra detail. Gửi tiếp có thể tạo evidence trùng;
            nháp hiện tại được giữ.
          </p>
        </>
      )}
      {mutation.status === "locked" && (
        <Alert className="block break-words" variant="destructive" role="alert">
          CASE_CLOSED: form đã khóa. Tải lại detail và nhờ reviewer xử lý
          workflow.
        </Alert>
      )}
      {mutation.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {mutation.error.message}{" "}
          {mutation.error.requestId && (
            <>Request ID: {mutation.error.requestId}</>
          )}
        </Alert>
      )}
      {!detailReady && (
        <p role="status">
          Chờ detail hợp lệ trước khi gửi. Nháp vẫn giữ trong form.
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
          <legend>Nội dung evidence</legend>
          <label className="type-label block" htmlFor="evidence-kind">Loại evidence</label>
          <Select id="evidence-kind" {...register("kind")}>
            <option value="note">Note</option>
            <option value="events">Events trong snapshot</option>
          </Select>
          {kind === "events" && (
            <fieldset>
              <legend>Chọn events trong snapshot (tối đa 1.000)</legend>
              {snapshot.status === "loading" && (
                <LoadingState message="Đang tải graph snapshot…" />
              )}
              {snapshot.status === "error" && (
                <>
                  <Alert className="block break-words" variant="destructive" role="alert">
                    {snapshot.error?.message}{" "}
                    {snapshot.error?.requestId && (
                      <>Request ID: {snapshot.error.requestId}</>
                    )}
                  </Alert>
                  <Button variant="secondary"
                    type="button"
                    onClick={() => {
                      void loadSnapshot();
                    }}
                  >
                    Tải lại snapshot
                  </Button>
                </>
              )}
              {snapshot.status === "ready" && snapshot.events.length === 0 && (
                <p>Snapshot không có event để chọn.</p>
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
                    {event.event_id} — {event.service} / {event.action} /{" "}
                    {event.occurred_at}
                  </label>
                ))}
              <p>Đã chọn {selected.length} events.</p>
              {errors.event_ids && (
                <Alert className="block break-words" variant="destructive" role="alert">{errors.event_ids.message}</Alert>
              )}
            </fieldset>
          )}
          <label className="type-label block" htmlFor="evidence-note">
            Note (tối đa 10.000 ký tự; được rỗng với Events)
          </label>
          <Textarea
            id="evidence-note"
            aria-invalid={!!errors.note}
            aria-describedby={errors.note ? "evidence-note-error" : undefined}
            {...register("note")}
          />
          {errors.note && (
            <Alert className="block break-words" variant="destructive" id="evidence-note-error" role="alert">
              {errors.note.message}
            </Alert>
          )}
          <Button variant="primary" type="submit" disabled={!snapshotReady}>
            Thêm evidence
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
