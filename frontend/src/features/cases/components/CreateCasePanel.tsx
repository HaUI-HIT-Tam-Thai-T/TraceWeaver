import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import type { EventsScope } from "../../events/state/state";
import { reconstructionService } from "../../reconstruction/services/service";
import { casesService } from "../services/service";
import { caseCreateSchema } from "../schemas";
import type { CaseCreate } from "../schemas";
import { createCaseCreationController, initialCaseCreation } from "../state/createCaseController";

const titleFormSchema = caseCreateSchema.pick({ title: true });
const hiddenState = initialCaseCreation();
export function CreateCasePanel({
  runId,
  scope,
  anchor,
}: {
  runId: string;
  scope: EventsScope;
  anchor: object;
}) {
  const { refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [controller] = useState(() =>
    createCaseCreationController({
      service: casesService,
      getRun: reconstructionService.getRun,
      revalidate: refreshAccess,
    }),
  );
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);
    // Catch a change between rendering and registering the listener.
    handleChange();
    return unsubscribe;
  }, [controller]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Pick<CaseCreate, "title">>({
    resolver: zodResolver(titleFormSchema),
    defaultValues: { title: "" },
  });
  useEffect(() => {
    controller.sync(scope, runId, anchor);
    reset({ title: "" });
    return () => controller.stop();
  }, [controller, scope, runId, anchor, reset]);
  const state = controller.matches(scope, runId, anchor) ? snapshot : hiddenState;
  useEffect(() => {
    if (state.status === "success" && state.caseId) navigate(`/cases/${state.caseId}`);
  }, [state.status, state.caseId, navigate]);
  const busy = state.status === "validating" || state.status === "sending";
  return (
    <section aria-labelledby="create-case-title" className="mt-6 space-y-3 border-t pt-4">
      <h3 id="create-case-title" className="text-xl font-semibold">
        Tạo hồ sơ từ kết quả tái dựng
      </h3>
      <p>
        Lưu kết quả này thành hồ sơ để phân công, điều tra và xác minh. Rời trang không hủy hồ sơ đã
        được tạo.
      </p>
      <form onSubmit={handleSubmit(({ title }) => controller.create(title))}>
        <fieldset disabled={state.status !== "idle"}>
          <label className="type-label block" htmlFor="case-title">
            Tiêu đề hồ sơ
          </label>
          <Input
            id="case-title"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "case-title-error" : undefined}
            {...register("title")}
          />
          {errors.title && (
            <Alert
              className="block break-words"
              variant="destructive"
              id="case-title-error"
              role="alert"
            >
              {errors.title.message}
            </Alert>
          )}
          <Button variant="primary" type="submit">
            Tạo hồ sơ
          </Button>
        </fieldset>
      </form>
      {busy && (
        <p role="status">
          {state.status === "validating"
            ? "Đang kiểm tra kết quả tái dựng và quyền…"
            : "Đang tạo hồ sơ…"}
        </p>
      )}
      {state.error && (
        <Alert className="block break-words" variant="destructive" role="alert">
          {state.error.message} {state.error.requestId && <>Request ID: {state.error.requestId}</>}
        </Alert>
      )}
      {state.status === "uncertain" && (
        <>
          <Alert className="block break-words" variant="destructive" role="alert">
            Chưa rõ hồ sơ đã được tạo hay chưa. Gửi lại trong 24 giờ dùng nội dung và mã chống trùng
            cũ. Bắt đầu thao tác mới có thể tạo thêm hồ sơ.
          </Alert>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              void controller.retry();
            }}
          >
            Gửi lại thao tác tạo hồ sơ
          </Button>
        </>
      )}
      {state.status === "reauth" && (
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            void signIn();
          }}
        >
          Đăng nhập lại
        </Button>
      )}
      {["error", "uncertain"].includes(state.status) && (
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            controller.newOperation();
          }}
        >
          Bắt đầu thao tác tạo hồ sơ mới
        </Button>
      )}
    </section>
  );
}
