import { caseActionLabel } from "../presentation";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/primitives/alert";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/primitives/textarea";
import { LoadingState } from "../../../components/ui/LoadingState";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CaseDetail } from "../schemas";
import type {
  CaseWorkflow,
  CaseWorkflowGraph,
  CasesScope,
} from "../state/state";
import {
  caseActionSchema,
  transitionSchema,
  transitionIssue,
  transitionStates,
} from "../workflow";
import type { CaseTransition } from "../workflow";

type Props = {
  detail: CaseDetail;
  scope: CasesScope;
  ready: boolean;
  workflow: CaseWorkflow;
  graph: CaseWorkflowGraph;
  submit: (body: CaseTransition) => Promise<void>;
  retry: () => Promise<void>;
  beginNew: () => void;
};
export function WorkflowForm(props: Props) {
  if (!props.scope.canWrite) return null;
  return <WorkflowEditor {...props} />;
}
function WorkflowEditor({
  detail,
  scope,
  ready,
  workflow,
  graph,
  submit,
  retry,
  beginNew,
}: Props) {
  const first =
    caseActionSchema.options.find(
      (action) => transitionStates[action].from === detail.case.state,
    ) ?? "assign";
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CaseTransition>({
    resolver: zodResolver(transitionSchema),
    defaultValues: {
      action: first,
      expected_version: detail.case.version,
      reason: "",
      ...(first === "assign" ? { owner_id: scope.subject } : {}),
    },
    shouldUnregister: true,
  });
  const action = useWatch({ control, name: "action" });
  const reason = useWatch({ control, name: "reason" });
  const expected = useWatch({ control, name: "expected_version" });
  const busy =
    !ready ||
    isSubmitting ||
    ["validating", "sending"].includes(workflow.status);
  const issue = transitionIssue(detail, scope, action, reason);
  const frozen = workflow.attempt !== null || workflow.status === "conflict";
  return (
    <section className="my-6 space-y-3" aria-labelledby="workflow-title">
      <h2 id="workflow-title">Xử lý hồ sơ</h2>
      <p>
        Hệ thống sẽ kiểm tra lại quyền và người xử lý khi gửi. Nhập mã tài khoản do quản trị viên cung cấp hoặc chọn Giao cho tôi; hiện chưa có danh sách tài khoản để chọn.
      </p>
      <details><summary>Phiên bản hồ sơ đang xử lý</summary><p>Case.version đã chọn: {expected}; hiện tại: {detail.case.version}.</p></details>
      <form
        onSubmit={handleSubmit((values) => submit(values))}
        className="space-y-3"
      >
        <fieldset disabled={busy || frozen} className="space-y-3">
          <label className="type-label block" htmlFor="workflow-action">Thao tác</label>
            <Select id="workflow-action" {...register("action")}>
              {caseActionSchema.options.map((value) => (
                <option
                  key={value}
                  value={value}
                  disabled={
                    transitionStates[value].from !== detail.case.state ||
                    (["verify_close", "verification_failed", "reopen"].includes(
                      value,
                    ) &&
                      !scope.canVerify)
                  }
                >
                  {caseActionLabel(value)}
                </option>
              ))}
            </Select>
          <input
            type="hidden"
            {...register("expected_version", { valueAsNumber: true })}
          />
          {errors.expected_version && (
            <Alert className="block break-words" variant="destructive" role="alert">Phiên bản hồ sơ không hợp lệ; chọn lại phiên bản hiện tại.</Alert>
          )}
          {errors.action && <Alert className="block break-words" variant="destructive" role="alert">Chọn thao tác phù hợp.</Alert>}
          {action === "assign" && (
            <div>
              <label className="type-label block">
                Người xử lý (mã tài khoản){" "}
                <Input
                  {...register("owner_id")}
                  aria-invalid={!!errors.owner_id}
                />
              </label>
              <Button variant="secondary"
                type="button"
                onClick={() => setValue("owner_id", scope.subject)}
              >
                Giao cho tôi
              </Button>
              {errors.owner_id && <Alert className="block break-words" variant="destructive" role="alert">{errors.owner_id.message}</Alert>}
            </div>
          )}
          <label className="type-label block">
            Lý do{" "}
            <Textarea
              {...register("reason")}
              maxLength={1000}
              aria-invalid={!!errors.reason}
              aria-describedby="workflow-reason-error"
            />
          </label>
          {errors.reason && (
            <Alert className="block break-words" variant="destructive" id="workflow-reason-error" role="alert">
              {errors.reason.message}
            </Alert>
          )}
          {issue && <p role="status">{issue}</p>}
          <Button variant="primary" type="submit" disabled={!!issue}>
            Xác nhận thao tác
          </Button>
        </fieldset>
      </form>
      {workflow.status === "validating" && (
        <LoadingState message="Đang kiểm tra hồ sơ và điều kiện hiện tại…" />
      )}
      {workflow.status === "sending" && (
        <LoadingState message="Đang cập nhật hồ sơ…" />
      )}
      {workflow.status === "success" && (
        <p role="status">
          Đã cập nhật hồ sơ.{" "}
          {ready
            ? "Thông tin hiện tại đã được tải lại."
            : "Chưa tải được thông tin mới; hãy tải lại hồ sơ, không gửi lại thao tác."}
        </p>
      )}
      {workflow.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {workflow.status === "conflict" ? "Hồ sơ đã thay đổi. Đọc thông tin mới và chủ động chọn phiên bản hiện tại trước khi gửi tiếp." : workflow.error.message}<details><summary>Mã tra cứu</summary>{workflow.error.code}</details>
        </Alert>
      )}
      {action === "verify_close" && (
        <p>
          Liên kết còn chờ duyệt trong toàn bộ kết quả tái dựng:{" "}
          {graph.pendingCount ?? "sẽ kiểm tra kết quả mới nhất"}.
        </p>
      )}
      {workflow.status === "uncertain" && (
        <>
          <p>
            Chưa rõ kết quả. Gửi lại trong 24 giờ dùng nội dung và mã chống trùng cũ. Bắt đầu thao tác mới có thể tạo thêm lần cập nhật.
          </p>
          <Button variant="secondary"
            type="button"
            disabled={busy || workflow.error?.code === "IDEMPOTENCY_EXPIRED"}
            onClick={() => void retry()}
          >
            Gửi lại thao tác
          </Button>
        </>
      )}
      {(workflow.attempt || workflow.status === "conflict") && (
        <Button variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            beginNew();
            setValue("expected_version", detail.case.version);
            if (workflow.status === "success") {
              setValue("action", first);
              setValue("reason", "");
            }
            if (getValues("action") !== "assign")
              setValue("owner_id", undefined);
          }}
        >
          {workflow.status === "conflict"
            ? "Dùng phiên bản hồ sơ hiện tại"
            : "Bắt đầu thao tác mới với phiên bản hiện tại"}
        </Button>
      )}
      <p>Rời trang hoặc ngừng chờ không có nghĩa thao tác đã bị hủy trên hệ thống.</p>
    </section>
  );
}
