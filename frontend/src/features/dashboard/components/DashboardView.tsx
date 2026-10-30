import { SectionReveal } from "../../../components/ui/SectionReveal";
import { Card, CardContent } from "../../../components/ui/primitives/card";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dashboardFormDefaults, dashboardFormSchema, toDashboardFilters } from "../query";
import type { DashboardFormValues } from "../query";
import type { DashboardFilters, Dashboard } from "../schemas";

export function DashboardTimeForm({
  filters,
  apply,
}: {
  filters: DashboardFilters;
  apply: (filters: DashboardFilters) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardFormSchema),
    defaultValues: dashboardFormDefaults(filters),
  });
  return (
    <form
      aria-label="Lọc thời gian dashboard"
      className="filter-grid"
      onSubmit={handleSubmit((values) => apply(toDashboardFilters(values)))}
    >
      <p className="filter-wide type-caption text-muted">
        Lọc theo ngày tạo lần tái dựng, múi giờ UTC+7.
      </p>
      <div className="filter-field">
        <label className="type-label block" htmlFor="dashboard-from">
          Tái dựng tạo từ
        </label>
        <Input id="dashboard-from" type="datetime-local" step="any" {...register("from")} />
      </div>
      <div className="filter-field">
        <label className="type-label block" htmlFor="dashboard-to">
          Tái dựng tạo đến
        </label>
        <Input
          id="dashboard-to"
          type="datetime-local"
          step="any"
          {...register("to")}
          aria-invalid={!!errors.to}
          aria-describedby={errors.to ? "dashboard-time-error" : undefined}
        />
      </div>
      {errors.to && (
        <Alert
          className="block break-words"
          variant="destructive"
          id="dashboard-time-error"
          role="alert"
        >
          {errors.to.message}
        </Alert>
      )}
      <Button variant="primary" type="submit">
        Áp dụng
      </Button>
    </form>
  );
}
export function DashboardCounters({
  data,
  waiting,
  showWaiting,
}: {
  data: Dashboard;
  waiting: boolean;
  showWaiting: () => void;
}) {
  return (
    <SectionReveal>
      <section aria-label="Bốn counter dashboard" className="my-4 space-y-3">
        <p className="type-caption text-muted">
          Hồ sơ chờ xử lý gồm Mới và Đã phân công. Lượt sự kiện chưa liên kết được đếm theo từng lần
          tái dựng hoàn tất; cùng một sự kiện có thể được tính trong nhiều lần. Bộ lọc thời gian áp
          dụng ngày tạo lần tái dựng.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Lần tái dựng được phép xem", value: data.runs },
            {
              label: "Lần tái dựng dùng phương án dự phòng",
              value: data.degraded_runs,
            },
            {
              label: "Lượt sự kiện chưa liên kết",
              value: data.unresolved_events,
            },
            { label: "Hồ sơ chờ xử lý", value: data.waiting_cases },
          ].map((counter) => (
            <Card key={counter.label} className="min-w-0 border-line shadow-none">
              <CardContent>
                <dl>
                  <dt className="type-body-sm break-words text-muted">{counter.label}</dt>
                  <dd className="type-h1 mt-3 tabular-nums text-foreground">{counter.value}</dd>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          variant="secondary"
          type="button"
          aria-expanded={waiting}
          aria-controls="waiting-cases"
          onClick={showWaiting}
        >
          {waiting ? "Ẩn hồ sơ chờ xử lý" : "Xem hồ sơ cần xử lý"}
        </Button>
      </section>
    </SectionReveal>
  );
}
