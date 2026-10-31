import { z } from "zod";

const idSchema = z.uuid();
export const roleSchema = z.enum(["viewer", "operator", "reviewer", "admin", "ingest_service"]);
export const membershipSchema = z.strictObject({
  workspace_id: idSchema,
  workspace_name: z.string().trim().min(1).max(200).optional(),
  roles: z.array(roleSchema).refine((roles) => new Set(roles).size === roles.length),
  group_ids: z.array(idSchema).refine((ids) => new Set(ids).size === ids.length),
});
export const meSchema = z.strictObject({
  subject: z.string().min(1).max(255),
  memberships: z
    .array(membershipSchema)
    .refine((items) => new Set(items.map((item) => item.workspace_id)).size === items.length),
});
export const sourceSchema = z.strictObject({
  id: idSchema,
  workspace_id: idSchema,
  name: z.string().min(1).max(200),
  service: z.string().min(1).max(100),
  parser_version: z.string().min(1).max(100),
});
export const sourcesPageSchema = z.strictObject({
  items: z
    .array(sourceSchema)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  next_cursor: z.string().min(1).max(4096).nullable(),
});
export const sourcesQuerySchema = z.object({
  workspaceId: idSchema,
  cursor: z.string().min(1).max(4096).optional(),
  limit: z.number().int().min(1).max(100),
});
