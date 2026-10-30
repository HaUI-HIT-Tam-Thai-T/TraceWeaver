import { z } from "zod";
import { knowledgeFiltersSchema } from "./schemas.ts";
import type { KnowledgeFilters } from "./schemas.ts";

export function readKnowledgeQuery(search: string) {
  const params = new URLSearchParams(search);
  if (["q", "limit"].some((key) => params.getAll(key).length > 1))
    return { success: false } as const;
  const result = knowledgeFiltersSchema.safeParse({
    ...(params.has("q") ? { q: params.get("q") } : {}),
    limit: params.has("limit") ? Number(params.get("limit")) : 50,
  });
  if (!result.success || ![25, 50, 100].includes(result.data.limit))
    return { success: false } as const;
  return { success: true, filters: result.data } as const;
}
export function writeKnowledgeQuery(filters: KnowledgeFilters) {
  return new URLSearchParams({
    limit: String(filters.limit),
    ...(filters.q !== undefined ? { q: filters.q } : {}),
  });
}
export const knowledgeFormSchema = z.object({
  q: z.string().max(500, "Tìm kiếm tối đa 500 ký tự."),
  limit: z.enum(["25", "50", "100"]),
});
export type KnowledgeFormValues = z.infer<typeof knowledgeFormSchema>;
export function knowledgeFormDefaults(filters: KnowledgeFilters): KnowledgeFormValues {
  return {
    q: filters.q ?? "",
    limit: filters.limit === 25 ? "25" : filters.limit === 100 ? "100" : "50",
  };
}
