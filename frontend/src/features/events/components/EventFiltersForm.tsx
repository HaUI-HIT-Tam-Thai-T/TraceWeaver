import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWorkspace } from "../../workspace/hooks/useWorkspace";
import { useEvents } from "../hooks/useEvents";
import { eventFormSchema, formDefaults, formToFilters } from "../query";
import type { EventFormValues } from "../query";

export function EventFiltersForm() {
  const { state: workspace, loadMoreSources } = useWorkspace();
  const { state, setFilters } = useEvents();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: formDefaults(state.filters),
  });
  useEffect(() => {
    reset(formDefaults(state.filters));
  }, [state.filters, reset]);
  const sources = workspace.sources;
  const missingSource =
    state.filters.source_id &&
    !sources.items.some((source) => source.id === state.filters.source_id);
  const fields = [
    { name: "from", label: "Từ (UTC+7)", type: "datetime-local" },
    { name: "to", label: "Đến (UTC+7)", type: "datetime-local" },
    { name: "action", label: "Mã hoạt động chính xác (ví dụ: request.accepted)", type: "text" },
    { name: "q", label: "Tìm trong nội dung, mã hoạt động hoặc mã định danh", type: "search" },
  ] as const;
  return (
    <form
      className="ui-panel my-6 space-y-3"
      onSubmit={handleSubmit((values) => setFilters(formToFilters(values)))}
    >
      <p>
        Múi giờ nhập: Asia/Ho_Chi_Minh (UTC+7). Bộ lọc chỉ áp dụng khi bấm Tìm
        kiếm.
      </p>
      <label className="type-label block" htmlFor="event-source">
        Nguồn
      </label>
      <Select
        id="event-source"
        {...register("source_id")}
        aria-invalid={!!errors.source_id}
        aria-describedby={errors.source_id ? "event-source-error" : undefined}
      >
        <option value="">Tất cả nguồn được phép đọc</option>
        {missingSource && (
          <option value={state.filters.source_id}>
            Nguồn đang lọc (chưa tải được tên)
          </option>
        )}
        {sources.items.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name}
          </option>
        ))}
      </Select>
      {errors.source_id && (
        <Alert className="block break-words" variant="destructive" id="event-source-error" role="alert">
          {errors.source_id.message}
        </Alert>
      )}
      {sources.nextCursor && (
        <Button variant="secondary"
          type="button"
          disabled={sources.status === "loading"}
          onClick={() => {
            void loadMoreSources();
          }}
        >
          Tải thêm nguồn cho bộ lọc
        </Button>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ name, label, type }) => (
          <div key={name}>
            <label className="type-label block" htmlFor={`event-${name}`}>{label}</label>
            <Input
              id={`event-${name}`}
              type={type}
              step={type === "datetime-local" ? "any" : undefined}
              maxLength={
                name === "action" ? 200 : name === "q" ? 500 : undefined
              }
              {...register(name)}
              aria-invalid={!!errors[name]}
              aria-describedby={
                errors[name] ? `event-${name}-error` : undefined
              }
            />
            {errors[name] && (
              <Alert className="block break-words" variant="destructive" role="alert" id={`event-${name}-error`}>
                {errors[name].message}
              </Alert>
            )}
          </div>
        ))}
      </div>
      <label className="type-label block" htmlFor="event-limit">Số sự kiện mỗi trang</label>
      <Select id="event-limit" {...register("limit")}>
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </Select>
      <Button variant="primary"
        type="submit"
        disabled={state.status === "reauth"}
      >
        Tìm kiếm
      </Button>
    </form>
  );
}
