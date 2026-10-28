import { Card, CardContent } from '../../../components/ui/primitives/card';
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/primitives/alert";
import { Button } from "../../../components/ui/Button";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dashboardFormDefaults, dashboardFormSchema, toDashboardFilters } from '../query';
import type { DashboardFormValues } from '../query';
import type { DashboardFilters, Dashboard } from '../schemas';

export function DashboardTimeForm({ filters, apply }: { filters: DashboardFilters; apply: (filters: DashboardFilters) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<DashboardFormValues>({ resolver: zodResolver(dashboardFormSchema), defaultValues: dashboardFormDefaults(filters) });
  return <form aria-label="Lọc thời gian dashboard" className="my-4 space-y-3" onSubmit={handleSubmit(values => apply(toDashboardFilters(values)))}>
    <p>Thời gian theo run.created_at, gồm cả hai biên. Nhập theo Asia/Ho_Chi_Minh (UTC+7). Bấm Áp dụng để lọc cả counter và waiting cases.</p>
    <label className="type-label block" htmlFor="dashboard-from">Run tạo từ (UTC+7)</label>
    <Input id="dashboard-from" type="datetime-local" step="any" {...register('from')} />
    <label className="type-label block" htmlFor="dashboard-to">Run tạo đến (UTC+7)</label>
    <Input id="dashboard-to" type="datetime-local" step="any" {...register('to')} aria-invalid={!!errors.to} aria-describedby={errors.to ? 'dashboard-time-error' : undefined} />
    {errors.to && <Alert className="block break-words" variant="destructive" id="dashboard-time-error" role="alert">{errors.to.message}</Alert>}
    <Button variant="primary" type="submit">Áp dụng</Button>
  </form>;
}
export function DashboardCounters({ data, waiting, showWaiting }: { data: Dashboard; waiting: boolean; showWaiting: () => void }) {
  return <section aria-label="Bốn counter dashboard" className="my-4 space-y-3">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'Runs nhìn thấy được', value: data.runs },
        { label: 'Degraded runs', value: data.degraded_runs },
        { label: 'Unresolved event occurrences', value: data.unresolved_events },
        { label: 'Waiting cases (new + assigned)', value: data.waiting_cases },
      ].map(counter => <Card key={counter.label} className="min-w-0 border-line">
        <CardContent>
          <dl>
            <dt className="type-body-sm break-words text-muted">{counter.label}</dt>
            <dd className="type-h1 mt-3 text-foreground">{counter.value}</dd>
          </dl>
        </CardContent>
      </Card>)}
    </div>
    <p>Unresolved đếm occurrence theo từng run completed; cùng event có thể được đếm trong nhiều run.</p>
    <Button variant="secondary" type="button" aria-expanded={waiting} aria-controls="waiting-cases" onClick={showWaiting}>{waiting ? 'Ẩn waiting cases' : 'Xem waiting cases'}</Button>
  </section>;
}
