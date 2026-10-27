import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../auth/state/authContext";
import { useEvents } from "../../events/state/eventsContext";
import { eventsService } from "../../events/services/service";
import { useWorkspace } from "../../workspace/state/workspaceContext";
import { createReconstructionController } from "../state/controller";
import { reconstructionService } from "../services/service";
import { initialReconstructionState } from "../state/state";
import { runFormDefaults, runFormSchema, toRunBody } from "../form";
import type { RunFormValues } from "../form";
import type { Event } from "../../events/schemas";
import type { EventsScope } from "../../events/state/state";
import { RunResult } from "./RunResult";
import { linkReviewService } from "../../link-review/services/service";
import { CreateCasePanel } from "../../cases/components/CreateCasePanel";

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
  return <ReconstructionForm root={events.root} scope={events.scope} />;
}
function ReconstructionForm({
  root,
  scope,
}: {
  root: Event;
  scope: EventsScope;
}) {
  const { state: workspace, loadMoreSources, refreshAccess } = useWorkspace();
  const { signIn } = useAuth();
  const [controller] = useState(() =>
    createReconstructionController({
      service: reconstructionService,
      linkService: linkReviewService,
      getEvent: eventsService.getEvent,
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
  } = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema(root)),
    defaultValues: runFormDefaults(root),
  });
  useEffect(() => {
    controller.sync(scope, root);
    reset(runFormDefaults(root));
    return () => controller.stop();
  }, [controller, scope, root, reset]);
  const state = controller.matches(scope.accessKey, root)
    ? snapshot
    : hiddenState;
  const locked = state.phase !== "idle";
  const busy =
    state.phase === "sending" ||
    state.phase === "validating" ||
    state.mutation.status === "sending" ||
    state.tracking === "loading" ||
    state.graphStatus === "loading";
  const missingRoot = !workspace.sources.items.some(
    (source) => source.id === root.source_id,
  );
  return (
    <section
      className="mt-6 space-y-4 border-t pt-4"
      aria-labelledby="reconstruction-title"
    >
      <h2 id="reconstruction-title" className="text-2xl font-bold">
        Tạo reconstruction từ root
      </h2>
      <p>
        Root: {root.event_id} — UTC gốc: {root.occurred_at}. Múi giờ nhập
        Asia/Ho_Chi_Minh (UTC+7).
      </p>
      <p>
        Nhập theo dạng YYYY-MM-DDTHH:mm:ss, có thể thêm phần giây thập phân.
        Window tối đa một giờ và phải chứa root.
      </p>
      <form
        onSubmit={handleSubmit((value) =>
          controller.create(toRunBody(value, root)),
        )}
        className="space-y-3"
      >
        <fieldset disabled={locked} className="space-y-3">
          <legend>Thông tin run</legend>
          <fieldset>
            <legend>Nguồn trong run (chọn ít nhất một)</legend>
            {missingRoot && (
              <label className="block">
                <input
                  type="checkbox"
                  value={root.source_id}
                  {...register("source_ids")}
                />
                Nguồn root: {root.source_id}
              </label>
            )}
            {workspace.sources.items.map((source) => (
              <label className="block" key={source.id}>
                <input
                  type="checkbox"
                  value={source.id}
                  {...register("source_ids")}
                />
                {source.name} — {source.id}
              </label>
            ))}
          </fieldset>
          {errors.source_ids && (
            <p role="alert">Chọn ít nhất một nguồn có chứa nguồn root.</p>
          )}
          <label className="block" htmlFor="run-from">
            Từ (UTC+7)
          </label>
          <input
            id="run-from"
            type="text"
            placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
            aria-invalid={!!errors.from}
            {...register("from")}
          />
          <label className="block" htmlFor="run-to">
            Đến (UTC+7)
          </label>
          <input
            id="run-to"
            type="text"
            placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
            aria-invalid={!!errors.to}
            aria-describedby={errors.to ? "run-window-error" : undefined}
            {...register("to")}
          />
          {(errors.to || errors.from) && (
            <p id="run-window-error" role="alert">
              {errors.to?.message ?? errors.from?.message}
            </p>
          )}
          <label className="block" htmlFor="run-mode">
            Chế độ
          </label>
          <select id="run-mode" {...register("mode")}>
            <option value="rule_only">rule_only</option>
            <option value="hybrid">hybrid</option>
          </select>
          <button type="submit">Tạo run</button>
        </fieldset>
      </form>
      {workspace.sources.nextCursor && (
        <button
          type="button"
          disabled={locked || workspace.sources.status === "loading"}
          onClick={() => {
            void loadMoreSources();
          }}
        >
          Tải thêm nguồn cho run
        </button>
      )}
      {workspace.sources.error && (
        <p role="alert">
          Không tải được danh sách nguồn. Có thể thử lại từ phần Workspace.
        </p>
      )}
      {locked && (
        <button
          type="button"
          disabled={
            busy || state.phase === "blocked" || state.phase === "reauth"
          }
          onClick={() => {
            controller.newOperation();
            reset(runFormDefaults(root));
          }}
        >
          Bắt đầu thao tác mới
        </button>
      )}
      {state.phase === "uncertain" && (
        <p>
          Thao tác mới dùng key mới và có thể tạo thêm run nếu lần trước đã
          thành công.
        </p>
      )}
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
      {state.run?.status === "completed" && scope.canWrite && (
        <CreateCasePanel runId={state.run.id} scope={scope} anchor={root} />
      )}
    </section>
  );
}
