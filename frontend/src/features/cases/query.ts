import { z } from "zod";
import { localToUtc, utcToLocalInput } from "../events/query.ts";
import { caseFiltersSchema, caseStateSchema } from "./schemas.ts";
import type { CaseFilters } from "../../types/cases.ts";

const keys = ["state", "owner_id", "from", "to"] as const;
export function readCaseQuery(search: string) {
  const params = new URLSearchParams(search);
  if ([...keys, "limit"].some((key) => params.getAll(key).length > 1))
    return { success: false } as const;
  const parsed = caseFiltersSchema.safeParse({
    ...Object.fromEntries(keys.flatMap((key) => (params.has(key) ? [[key, params.get(key)]] : []))),
    limit: params.has("limit") ? Number(params.get("limit")) : 50,
  });
  if (!parsed.success || ![25, 50, 100].includes(parsed.data.limit))
    return { success: false } as const;
  return { success: true, filters: parsed.data } as const;
}
export function writeCaseQuery(filters: CaseFilters) {
  const params = new URLSearchParams({ limit: String(filters.limit) });
  for (const key of keys) if (filters[key] !== undefined) params.set(key, filters[key]);
  return params;
}
const formBase = z.object({
  state: z.union([z.literal(""), caseStateSchema]),
  owner_id: z.string().max(255),
  from: z.string(),
  to: z.string(),
  limit: z.enum(["25", "50", "100"]),
});
export type CaseFilterForm = z.infer<typeof formBase>;
export function toCaseFilters(value: CaseFilterForm): CaseFilters {
  return caseFiltersSchema.parse({
    ...(value.state ? { state: value.state } : {}),
    ...(value.owner_id ? { owner_id: value.owner_id } : {}),
    ...(value.from ? { from: localToUtc(value.from) } : {}),
    ...(value.to ? { to: localToUtc(value.to) } : {}),
    limit: Number(value.limit),
  });
}
export const caseFilterFormSchema = formBase.superRefine((value, ctx) => {
  try {
    toCaseFilters(value);
  } catch {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "Kiểm tra thời gian UTC+7 và khoảng từ/đến.",
    });
  }
});
export function caseFilterDefaults(filters: CaseFilters): CaseFilterForm {
  return {
    state: filters.state ?? "",
    owner_id: filters.owner_id ?? "",
    from: utcToLocalInput(filters.from),
    to: utcToLocalInput(filters.to),
    limit: filters.limit === 25 ? "25" : filters.limit === 100 ? "100" : "50",
  };
}
