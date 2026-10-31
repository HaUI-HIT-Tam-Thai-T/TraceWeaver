import { caseStateLabel } from "../presentation";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { useEffect, useRef } from "react";
import { FilterTimeRange } from "../../../components/ui/FilterTimeRange";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { caseFilterDefaults, caseFilterFormSchema, toCaseFilters } from "../query";
import type { CaseFilterForm } from "../query";
import type { CaseFilters } from "../../../types/cases";
import { caseStateSchema } from "../schemas";

export function CaseFiltersForm({
  filters,
  onSearch,
}: {
  filters: CaseFilters;
  onSearch: (filters: CaseFilters) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<CaseFilterForm>({
    resolver: zodResolver(caseFilterFormSchema),
    defaultValues: caseFilterDefaults(filters),
  });
  const previousFilters = useRef(filters);
  useEffect(() => {
    const previous = previousFilters.current;
    const sizeOnly =
      previous.limit !== filters.limit &&
      previous.state === filters.state &&
      previous.owner_id === filters.owner_id &&
      previous.from === filters.from &&
      previous.to === filters.to;
    reset(
      sizeOnly
        ? { ...getValues(), limit: caseFilterDefaults(filters).limit }
        : caseFilterDefaults(filters),
    );
    previousFilters.current = filters;
  }, [filters, reset, getValues]);
  return (
    <form
      onSubmit={handleSubmit((value) => onSearch(toCaseFilters(value)))}
      className="filter-grid case-filter-grid"
      aria-label="Bộ lọc cases"
    >
      <input type="hidden" {...register("limit")} />
      <div className="filter-field">
        <label className="type-label block" htmlFor="case-state">
          Trạng thái
        </label>
        <Select id="case-state" {...register("state")}>
          <option value="">Tất cả trạng thái</option>
          {caseStateSchema.options.map((state) => (
            <option key={state} value={state}>
              {caseStateLabel(state)}
            </option>
          ))}
        </Select>
      </div>
      <div className="filter-field">
        <label className="type-label block" htmlFor="case-owner">
          Mã tài khoản
        </label>
        <Input
          id="case-owner"
          aria-invalid={!!errors.owner_id}
          aria-describedby={errors.owner_id ? "case-owner-error" : undefined}
          {...register("owner_id")}
        />
        {errors.owner_id && (
          <Alert
            className="block break-words"
            variant="destructive"
            id="case-owner-error"
            role="alert"
          >
            Mã tài khoản người xử lý tối đa 255 ký tự.
          </Alert>
        )}
      </div>
      <FilterTimeRange
        id="case-time-range"
        expanded={!!(filters.from || filters.to)}
        hasError={!!errors.to}
      >
        <div className="filter-field">
          <label className="type-label block" htmlFor="case-from">
            Tái dựng tạo từ
          </label>
          <Input
            id="case-from"
            type="text"
            placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
            {...register("from")}
          />
        </div>
        <div className="filter-field">
          <label className="type-label block" htmlFor="case-to">
            Tái dựng tạo đến
          </label>
          <Input
            id="case-to"
            type="text"
            placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
            aria-invalid={!!errors.to}
            aria-describedby={errors.to ? "case-time-error" : undefined}
            {...register("to")}
          />
          {errors.to && (
            <Alert
              className="block break-words"
              variant="destructive"
              id="case-time-error"
              role="alert"
            >
              {errors.to.message}
            </Alert>
          )}
        </div>
      </FilterTimeRange>
      <Button className="filter-submit" variant="primary" type="submit">
        Tìm kiếm
      </Button>
      <details className="filter-help type-caption text-muted">
        <summary>Ý nghĩa bộ lọc</summary>
        <p>
          Lọc theo ngày tạo lần tái dựng, không theo ngày tạo hồ sơ. Múi giờ UTC+7. Danh sách phản
          ánh trạng thái hiện tại và có thể thay đổi giữa các trang.
        </p>
      </details>
    </form>
  );
}
