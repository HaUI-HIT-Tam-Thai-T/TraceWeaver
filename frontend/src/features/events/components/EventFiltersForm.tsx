import { sourceName } from "../presentation";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { DateTimePicker } from "../../../components/ui/DateTimePicker";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
    control,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: formDefaults(state.filters),
  });
  const [from, to] = useWatch({ control, name: ["from", "to"] });
  useEffect(() => {
    reset(formDefaults(state.filters));
  }, [state.filters, reset]);
  const sources = workspace.sources;
  const missingSource =
    state.filters.source_id &&
    !sources.items.some((source) => source.id === state.filters.source_id);
  const fields = [
    { name: "from", label: "Từ (UTC+7)" },
    { name: "to", label: "Đến (UTC+7)" },
  ] as const;
  return (
    <form
      className="filter-grid"
      onSubmit={handleSubmit((values) =>
        setFilters(formToFilters({ ...values, action: "", q: "" })),
      )}
    >
      {/* <p>
        Múi giờ nhập: Asia/Ho_Chi_Minh (UTC+7). Bộ lọc chỉ áp dụng khi bấm Tìm
        kiếm.
      </p> */}
      <div className="filter-field">
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
              {sourceName(source.name)}
            </option>
          ))}
        </Select>
        {errors.source_id && (
          <Alert
            className="block break-words"
            variant="destructive"
            id="event-source-error"
            role="alert"
          >
            {errors.source_id.message}
          </Alert>
        )}
        {sources.nextCursor && (
          <Button
            variant="secondary"
            type="button"
            disabled={sources.status === "loading"}
            onClick={() => {
              void loadMoreSources();
            }}
          >
            Tải thêm nguồn cho bộ lọc
          </Button>
        )}
      </div>
      <div className="filter-field">
        <label className="type-label block" htmlFor="event-limit">
          Số sự kiện mỗi trang
        </label>
        <Select id="event-limit" {...register("limit")}>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </Select>
      </div>
      <Button
        variant="primary"
        type="submit"
        disabled={state.status === "reauth"}
      >
        Tìm kiếm
      </Button>
      <div className="filter-wide grid gap-4 sm:grid-cols-2">
        {fields.map(({ name, label }) => (
          <div key={name}>
            <label className="type-label block" htmlFor={`event-${name}`}>
              {label}
            </label>
            <DateTimePicker
              id={`event-${name}`}
              name={name}
              label={label}
              value={name === "from" ? from : to}
              inputRef={register(name).ref}
              onChange={value => setValue(name, value, { shouldDirty: true })}
              onBlur={() => setValue(name, name === "from" ? from : to, { shouldTouch: true })}
              invalid={!!errors[name]}
              describedBy={errors[name] ? `event-${name}-error` : undefined}
            />
            {errors[name] && (
              <Alert
                className="block break-words"
                variant="destructive"
                role="alert"
                id={`event-${name}-error`}
              >
                {errors[name].message}
              </Alert>
            )}
          </div>
        ))}
      </div>
      {/* <p className="type-caption text-muted">Đang xem tối đa {state.filters.limit} sự kiện mỗi trang. Điều kiện ở trên là bộ lọc đã áp dụng, không phải nội dung đang nhập.</p> */}
    </form>
  );
}
