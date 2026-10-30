import { z } from "zod";
import { utcSchema } from "../events/schemas.ts";

export const knowledgeArticleSchema = z.strictObject({
  id: z.uuid(),
  workspace_id: z.uuid(),
  title: z.string().min(1).max(300).regex(/\S/),
  body: z.string().min(1).max(100000),
  version: z.number().int().min(1),
  author_subject: z.string().min(1).max(255),
  source_ref: z.url(),
  created_at: utcSchema,
});
export const knowledgePageSchema = z.strictObject({
  items: z
    .array(knowledgeArticleSchema)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  next_cursor: z.string().min(1).max(4096).nullable(),
});
export const knowledgeFiltersSchema = z.strictObject({
  q: z.string().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(100),
});
export type KnowledgeArticle = z.infer<typeof knowledgeArticleSchema>;
export type KnowledgePage = z.infer<typeof knowledgePageSchema>;
export type KnowledgeFilters = z.infer<typeof knowledgeFiltersSchema>;
