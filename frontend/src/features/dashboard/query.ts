import { z } from "zod";
import { localToUtc, utcToLocalInput } from "../events/query.ts";
import { dashboardFiltersSchema } from "./schemas.ts";
import type { DashboardFilters } from "./schemas.ts";
import { writeCaseQuery } from "../cases/query.ts";
export function readDashboardQuery(search: string) {
  const params = new URLSearchParams(search);
  if (
    ["from", "to", "waiting"].some((key) => params.getAll(key).length > 1) ||
    (params.has("waiting") && params.get("waiting") !== "1")
  )
    return { success: false } as const;
  const result = dashboardFiltersSchema.safeParse(
    Object.fromEntries(
      ["from", "to"].flatMap((key) => (params.has(key) ? [[key, params.get(key)]] : [])),
    ),
  );
  return result.success
    ? ({ success: true, filters: result.data, waiting: params.has("waiting") } as const)
    : ({ success: false } as const);
}
export function writeDashboardQuery(filters: DashboardFilters, waiting = false) {
  return new URLSearchParams({ ...filters, ...(waiting ? { waiting: "1" } : {}) });
}
export function waitingCaseQuery(filters: DashboardFilters, state: "new" | "assigned") {
  return writeCaseQuery({ ...filters, state, limit: 50 }).toString();
}
const timeForm = z.object({ from: z.string(), to: z.string() });
export type DashboardFormValues = z.infer<typeof timeForm>;
export function toDashboardFilters(values: DashboardFormValues): DashboardFilters {
  return dashboardFiltersSchema.parse({
    ...(values.from ? { from: localToUtc(values.from) } : {}),
    ...(values.to ? { to: localToUtc(values.to) } : {}),
  });
}
export const dashboardFormSchema = timeForm.superRefine((values, ctx) => {
  try {
    toDashboardFilters(values);
  } catch {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "Kiểm tra ngày hợp lệ và khoảng từ/đến theo UTC+7.",
    });
  }
});
export function dashboardFormDefaults(filters: DashboardFilters): DashboardFormValues {
  return { from: utcToLocalInput(filters.from), to: utcToLocalInput(filters.to) };
}
