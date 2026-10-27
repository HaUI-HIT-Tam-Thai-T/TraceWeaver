import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dashboardFormDefaults, dashboardFormSchema, toDashboardFilters } from './query';
import type { DashboardFormValues } from './query';
import type { DashboardFilters, Dashboard } from './schemas';

export function DashboardTimeForm({ filters, apply }: { filters: DashboardFilters; apply: (filters: DashboardFilters) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<DashboardFormValues>({ resolver: zodResolver(dashboardFormSchema), defaultValues: dashboardFormDefaults(filters) });
  return <form aria-label="Lọc thời gian dashboard" className="my-4 space-y-3" onSubmit={handleSubmit(values => apply(toDashboardFilters(values)))}>
    <p>Thời gian theo run.created_at, gồm cả hai biên. Nhập theo Asia/Ho_Chi_Minh (UTC+7). Bấm Áp dụng để lọc cả counter và waiting cases.</p>
    <label className="block" htmlFor="dashboard-from">Run tạo từ (UTC+7)</label>
    <input id="dashboard-from" type="datetime-local" step="any" {...register('from')} />
    <label className="block" htmlFor="dashboard-to">Run tạo đến (UTC+7)</label>
    <input id="dashboard-to" type="datetime-local" step="any" {...register('to')} aria-invalid={!!errors.to} aria-describedby={errors.to ? 'dashboard-time-error' : undefined} />
    {errors.to && <p id="dashboard-time-error" role="alert">{errors.to.message}</p>}
    <button type="submit">Áp dụng</button>
  </form>;
}
export function DashboardCounters({ data, waiting, showWaiting }: { data: Dashboard; waiting: boolean; showWaiting: () => void }) {
  return <section aria-label="Bốn counter dashboard" className="my-4 space-y-3">
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt>Runs nhìn thấy được</dt><dd>{data.runs}</dd></div>
      <div><dt>Degraded runs</dt><dd>{data.degraded_runs}</dd></div>
      <div><dt>Unresolved event occurrences</dt><dd>{data.unresolved_events}</dd></div>
      <div><dt>Waiting cases (new + assigned)</dt><dd>{data.waiting_cases}</dd></div>
    </dl>
    <p>Unresolved đếm occurrence theo từng run completed; cùng event có thể được đếm trong nhiều run.</p>
    <button type="button" aria-expanded={waiting} aria-controls="waiting-cases" onClick={showWaiting}>{waiting ? 'Ẩn waiting cases' : 'Xem waiting cases'}</button>
  </section>;
}
