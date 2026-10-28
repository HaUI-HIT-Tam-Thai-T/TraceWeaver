import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useWorkspace } from "../workspace/workspaceContext";
import type { EventsScope } from "../events/state";
import { reconstructionService } from "../reconstruction/service";
import { casesService } from "./service";
import { caseCreateSchema } from "./schemas";
import type { CaseCreate } from "./schemas";
import {
  createCaseCreationController,
  initialCaseCreation,
} from "./createCaseController";

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
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
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
  const state = controller.matches(scope, runId, anchor)
    ? snapshot
    : hiddenState;
  useEffect(() => {
    if (state.status === "success" && state.caseId)
      navigate(`/cases/${state.caseId}`);
  }, [state.status, state.caseId, navigate]);
  const busy = state.status === "validating" || state.status === "sending";
  return (
    <section
      aria-labelledby="create-case-title"
      className="mt-6 space-y-3 border-t pt-4"
    >
      <h3 id="create-case-title" className="text-xl font-semibold">
        Tạo case từ run completed
      </h3>
      <p>
        Run: {runId}. State/owner/workflow do BE quản lý. Hủy chờ ở FE không hủy
        case đã được tạo.
      </p>
      <form onSubmit={handleSubmit(({ title }) => controller.create(title))}>
        <fieldset disabled={state.status !== "idle"}>
          <label htmlFor="case-title">Tiêu đề case</label>
          <input
            id="case-title"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "case-title-error" : undefined}
            {...register("title")}
          />
          {errors.title && (
            <p id="case-title-error" role="alert">
              {errors.title.message}
            </p>
          )}
          <button type="submit">Tạo case</button>
        </fieldset>
      </form>
      {busy && (
        <p role="status">
          {state.status === "validating"
            ? "Đang kiểm tra run và quyền…"
            : "Đang tạo case…"}
        </p>
      )}
      {state.error && (
        <p role="alert">
          {state.error.message}{" "}
          {state.error.requestId && <>Request ID: {state.error.requestId}</>}
        </p>
      )}
      {state.status === "uncertain" && (
        <>
          <p role="alert">
            Chưa rõ case đã được tạo hay chưa. Gửi lại giữ nguyên body/key trong
            24 giờ; thao tác mới có thể tạo thêm case.
          </p>
          <button
            type="button"
            onClick={() => {
              void controller.retry();
            }}
          >
            Gửi lại thao tác tạo case
          </button>
        </>
      )}
      {state.status === "reauth" && (
        <button
          type="button"
          onClick={() => {
            void signIn();
          }}
        >
          Đăng nhập lại
        </button>
      )}
      {["error", "uncertain"].includes(state.status) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            controller.newOperation();
          }}
        >
          Bắt đầu thao tác tạo case mới
        </button>
      )}
    </section>
  );
}
