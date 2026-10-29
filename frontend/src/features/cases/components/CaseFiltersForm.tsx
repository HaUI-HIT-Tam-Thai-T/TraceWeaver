import { caseStateLabel } from "../presentation";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  caseFilterDefaults,
  caseFilterFormSchema,
  toCaseFilters,
} from "../query";
import type { CaseFilterForm } from "../query";
import type { CaseFilters } from "../schemas";
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
    formState: { errors },
  } = useForm<CaseFilterForm>({
    resolver: zodResolver(caseFilterFormSchema),
    defaultValues: caseFilterDefaults(filters),
  });
  useEffect(() => reset(caseFilterDefaults(filters)), [filters, reset]);
  return (
    <form
      onSubmit={handleSubmit((value) => onSearch(toCaseFilters(value)))}
      className="filter-grid"
      aria-label="Bộ lọc cases"
    >
      {/* <p>
        Bấm Tìm kiếm để áp dụng. Thời gian theo run.created_at (ngày tạo run),
        không theo ngày tạo case. Múi giờ nhập Asia/Ho_Chi_Minh (UTC+7).
      </p> */}
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
      <div className="filter-field">
        <label className="type-label block" htmlFor="case-limit">
          Số hồ sơ mỗi trang
        </label>
        <Select id="case-limit" {...register("limit")}>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </Select>
      </div>
      <Button variant="primary" type="submit">
        Tìm kiếm
      </Button>
    </form>
  );
}
