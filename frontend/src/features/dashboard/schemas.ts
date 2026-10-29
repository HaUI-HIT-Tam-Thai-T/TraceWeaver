import { z } from 'zod';
import { utcSchema, compareUtc } from '../events/schemas.ts';
export const dashboardFiltersSchema = z.strictObject({ from: utcSchema.optional(), to: utcSchema.optional() }).refine(value => !value.from || !value.to || compareUtc(value.from, value.to) <= 0, { path: ['to'], message: 'Thời gian kết thúc phải bằng hoặc sau thời gian bắt đầu.' });
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const dashboardSchema = z.strictObject({ runs: counter, degraded_runs: counter, unresolved_events: counter, waiting_cases: counter, filters: dashboardFiltersSchema });
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
