import { SectionReveal } from "../../../components/ui/SectionReveal";
import { Alert } from "../../../components/ui/primitives/alert";
import { PreciseDateTimeField } from "../../../components/ui/PreciseDateTimeField";
import { SourceScopePicker } from "./SourceScopePicker";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../../hooks/useAuth";
import { useEvents } from "../../../hooks/useEvents";
import { eventsService } from "../../events/eventsService";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { createReconstructionController } from "../state/controller";
import { reconstructionService } from "../reconstructionService";
import { initialReconstructionState } from "../state/state";
import { runFormDefaults, runFormSchema, toRunBody } from "../form";
import type { RunFormValues } from "../form";
import type { Event } from "../../../types/events";
import type { EventsScope } from "../../events/state/state";
import { RunResult } from "./RunResult";
import { linkReviewService } from "../review/linkReviewService";
import { CreateCasePanel } from "../../cases/components/CreateCasePanel";
import { actionLabel, requestLabel, sourceLabel } from "../../events/presentation";
import { EventTime, EventTechnicalDetails } from "../../events/components/EventPresentation";

const hiddenState = initialReconstructionState();
export function ReconstructionPanel() {
  const { state: events } = useEvents();
  const { state: auth } = useAuth();
  const { state: workspace, permissions } = useWorkspace();
  if (
    auth.status !== "authenticated" ||
    workspace.status !== "ready" ||
    !permissions.canWrite ||
    !events.root ||
    !events.scope ||
    events.scope.accessKey !== workspace.me ||
    events.status !== "active"
  )
    return null;
  return <ReconstructionForm key={events.root.event_id} root={events.root} scope={events.scope} />;
}
function ReconstructionForm({ root, scope }: { root: Event; scope: EventsScope }) {
  const { state: workspace, refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const [controller] = useState(() =>
    createReconstructionController({
      service: reconstructionService,
      linkService: linkReviewService,
      getEvent: eventsService.getEvent,
      revalidate: refreshAccess,
    }),
  );
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);

  useEffect(() => {
    function handleChange() {
      setSnapshot(controller.getSnapshot());
    }
    const unsubscribe = controller.subscribe(handleChange);

    handleChange();
    return unsubscribe;
  }, [controller]);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema(root)),
    defaultValues: runFormDefaults(root),
  });
  useEffect(() => {
    controller.sync(scope, root);
    reset(runFormDefaults(root));
    return () => controller.stop();
  }, [controller, scope, root, reset]);
  const state = controller.matches(scope.accessKey, root) ? snapshot : hiddenState;
  const [choosingAll, setChoosingAll] = useState(false);
  const selectedSources = useWatch({ control, name: "source_ids" });
  const fromValue = useWatch({ control, name: "from" });
  const toValue = useWatch({ control, name: "to" });
  const requestedMode = useWatch({ control, name: "mode" });
  const locked = state.phase !== "idle";
  const busy =
    state.phase === "sending" ||
    state.phase === "validating" ||
    state.mutation.status === "sending" ||
    state.tracking === "loading" ||
    state.graphStatus === "loading";
  return (
    <section
      className="mt-8 space-y-6 border-t border-line pt-6"
      aria-labelledby="reconstruction-title"
    >
      <h2 id="reconstruction-title" className="text-2xl font-bold">
        Tái dựng từ sự kiện đã chọn
      </h2>
      <p>
        Điểm bắt đầu: {requestLabel(root)} — {actionLabel(root.action)}.{" "}
        {sourceLabel(root, workspace.sources.items)} · <EventTime value={root.occurred_at} />{" "}
        (UTC+7).
      </p>
      <EventTechnicalDetails key={root.event_id} event={root} />
      <ol className="grid list-inside list-decimal gap-4 rounded-xl bg-control p-5 lg:grid-cols-3">
        <li>
          <strong>Chọn điểm bắt đầu:</strong> sự kiện mốc để tìm những bước liên quan; không mặc
          định đây là bước đầu tiên của toàn bộ yêu cầu.
        </li>
        <li>
          <strong>Chọn đủ nguồn và thời gian:</strong> mặc định 5 phút trước/sau mốc; mở rộng khi
          quá trình diễn ra ở nguồn khác, tối đa một giờ.
        </li>
        <li>
          <strong>Chọn cách tái dựng:</strong> tạo kết quả rồi kiểm tra dòng thời gian, bằng chứng
          và các liên kết cần duyệt.
        </li>
      </ol>
      <div className="reconstruction-grid">
        <form
          onSubmit={handleSubmit((value) => {
            if (!choosingAll) return controller.create(toRunBody(value, root));
          })}
          className="content-panel space-y-4"
        >
          <fieldset disabled={locked} className="space-y-3">
            <legend>Phạm vi tái dựng</legend>
            <SourceScopePicker
              rootSource={root.source_id}
              selected={selectedSources}
              disabled={locked}
              onChange={(ids) =>
                setValue("source_ids", ids, { shouldValidate: true, shouldDirty: true })
              }
              onBusy={setChoosingAll}
            />
            {errors.source_ids && (
              <Alert className="block break-words" variant="destructive" role="alert">
                Chọn ít nhất một nguồn, bao gồm nguồn của sự kiện bắt đầu.
              </Alert>
            )}
            <input type="hidden" {...register("from")} />
            <input type="hidden" {...register("to")} />
            <PreciseDateTimeField
              id="run-from"
              label="Từ (UTC+7)"
              value={fromValue}
              invalid={!!errors.from}
              describedBy="run-window-error"
              onChange={(value) =>
                setValue("from", value, { shouldValidate: true, shouldDirty: true })
              }
            />
            <PreciseDateTimeField
              id="run-to"
              label="Đến (UTC+7)"
              value={toValue}
              invalid={!!errors.to}
              describedBy="run-window-error"
              onChange={(value) =>
                setValue("to", value, { shouldValidate: true, shouldDirty: true })
              }
            />
            <p className="type-caption text-muted">
              Khoảng thời gian phải chứa sự kiện bắt đầu. Phần giây thập phân gốc được giữ nguyên,
              không làm tròn.
            </p>
            {(errors.to || errors.from) && (
              <Alert
                className="block break-words"
                variant="destructive"
                id="run-window-error"
                role="alert"
              >
                {errors.to?.message ?? errors.from?.message}
              </Alert>
            )}
            <label className="type-label block" htmlFor="run-mode">
              Chế độ
            </label>
            <Select id="run-mode" {...register("mode")}>
              <option value="rule_only">Theo luật</option>
              <option value="hybrid">Kết hợp luật và AI</option>
            </Select>
            <p className="type-body-sm text-muted">
              {requestedMode === "rule_only"
                ? "Dùng quy tắc và mã định danh đã cấu hình để tìm liên kết."
                : "Kết hợp quy tắc với gợi ý của mô hình AI. Nếu AI chưa sẵn sàng, hệ thống có thể trả kết quả theo luật và kèm cảnh báo."}
            </p>
            <Button variant="primary" type="submit" disabled={choosingAll}>
              Bắt đầu tái dựng
            </Button>
          </fieldset>
        </form>
        <aside className="reconstruction-summary space-y-4" aria-label="Tóm tắt phạm vi tái dựng">
          <h3 className="type-h3">Phạm vi đang chọn</h3>
          <p className="type-body-sm">
            {actionLabel(root.action)} · {requestLabel(root)}
          </p>
          <p>
            <strong>{selectedSources.length}</strong> nguồn được chọn
          </p>
          <dl className="space-y-2 break-words type-body-sm">
            <dt>Từ (UTC+7)</dt>
            <dd>{fromValue.replace("T", " ")}</dd>
            <dt>Đến (UTC+7)</dt>
            <dd>{toValue.replace("T", " ")}</dd>
          </dl>
          <p>{requestedMode === "hybrid" ? "Kết hợp luật và AI" : "Theo luật"}</p>
          <p className="type-caption text-muted">
            Hệ thống sẽ kiểm tra lại sự kiện bắt đầu và quyền truy cập khi gửi. Kết quả chỉ sử dụng
            phạm vi này.
          </p>
        </aside>
      </div>
      {locked && (
        <Button
          variant="secondary"
          type="button"
          disabled={busy || state.phase === "blocked" || state.phase === "reauth"}
          onClick={() => {
            controller.newOperation();
            reset(runFormDefaults(root));
          }}
        >
          Bắt đầu thao tác mới
        </Button>
      )}
      {state.phase === "uncertain" && (
        <p>
          Bắt đầu lại có thể tạo thêm một kết quả nếu lần trước đã xử lý thành công. Hãy kiểm tra
          kết quả trước khi xác nhận.
        </p>
      )}
      {state.phase !== "idle" && (
        <SectionReveal className="min-w-0">
          <RunResult
            linkActions={controller}
            canWrite={scope.canWrite}
            state={state}
            retry={() => {
              void controller.retry();
            }}
            track={() => {
              void controller.track();
            }}
            loadGraph={() => {
              void controller.loadGraph();
            }}
            signIn={() => {
              void signIn();
            }}
          />
        </SectionReveal>
      )}
      {state.run?.status === "completed" && scope.canWrite && (
        <CreateCasePanel runId={state.run.id} scope={scope} anchor={root} />
      )}
    </section>
  );
}
