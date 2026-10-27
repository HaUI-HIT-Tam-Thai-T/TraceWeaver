import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  caseFilterDefaults,
  caseFilterFormSchema,
  toCaseFilters,
} from "./query";
import type { CaseFilterForm } from "./query";
import type { CaseFilters } from "./schemas";
import { caseStateSchema } from "./schemas";

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
    formState: { errors },
  } = useForm<CaseFilterForm>({
    resolver: zodResolver(caseFilterFormSchema),
    defaultValues: caseFilterDefaults(filters),
  });
  useEffect(() => reset(caseFilterDefaults(filters)), [filters, reset]);
  return (
    <form
      onSubmit={handleSubmit((value) => onSearch(toCaseFilters(value)))}
      className="my-4 space-y-3"
      aria-label="Bộ lọc cases"
    >
      <p>
        Bấm Tìm kiếm để áp dụng. Thời gian theo run.created_at (ngày tạo run),
        không theo ngày tạo case. Múi giờ nhập Asia/Ho_Chi_Minh (UTC+7).
      </p>
      <label htmlFor="case-state">Trạng thái</label>
      <select id="case-state" {...register("state")}>
        <option value="">Tất cả trạng thái</option>
        {caseStateSchema.options.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>
      <label htmlFor="case-owner">Owner subject</label>
      <input
        id="case-owner"
        aria-invalid={!!errors.owner_id}
        aria-describedby={errors.owner_id ? "case-owner-error" : undefined}
        {...register("owner_id")}
      />
      {errors.owner_id && (
        <p id="case-owner-error" role="alert">
          Owner subject tối đa 255 ký tự.
        </p>
      )}
      <label htmlFor="case-from">Run tạo từ (UTC+7)</label>
      <input
        id="case-from"
        type="text"
        placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
        {...register("from")}
      />
      <label htmlFor="case-to">Run tạo đến (UTC+7)</label>
      <input
        id="case-to"
        type="text"
        placeholder="YYYY-MM-DDTHH:mm:ss.ffffff"
        aria-invalid={!!errors.to}
        aria-describedby={errors.to ? "case-time-error" : undefined}
        {...register("to")}
      />
      {errors.to && (
        <p id="case-time-error" role="alert">
          {errors.to.message}
        </p>
      )}
      <label htmlFor="case-limit">Số case mỗi trang</label>
      <select id="case-limit" {...register("limit")}>
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
      <button type="submit">Tìm kiếm</button>
    </form>
  );
}
