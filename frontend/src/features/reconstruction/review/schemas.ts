import { z } from "zod";
import { utcSchema } from "../../events/schemas.ts";
import type { Graph } from "../../../types/reconstruction.ts";

export const reasonSchema = z
  .string()
  .trim()
  .min(1, "Nhập lý do có nội dung.")
  .max(1000, "Lý do tối đa 1.000 ký tự.");
export const reviewCreateSchema = z.strictObject({
  decision: z.enum(["accepted", "rejected"]),
  reason: reasonSchema,
  expected_version: z.number().int().min(1),
});
export const reviewSchema = z.strictObject({
  id: z.uuid(),
  link_id: z.uuid(),
  decision: z.enum(["accepted", "rejected"]),
  reason: reasonSchema,
  actor_subject: z.string().min(1).max(255),
  created_at: utcSchema,
  link_version: z.number().int().min(1),
});
export const manualLinkCreateSchema = z
  .strictObject({
    from_event_id: z.uuid(),
    to_event_id: z.uuid(),
    reason: reasonSchema,
  })
  .refine((value) => value.from_event_id !== value.to_event_id, {
    path: ["to_event_id"],
    message: "Hai event phải khác nhau.",
  });
export const reviewFormSchema = reviewCreateSchema.extend({
  link_id: z.uuid("Chọn một link."),
});
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ManualLinkCreate = z.infer<typeof manualLinkCreateSchema>;
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
export function manualLinkIssue(
  body: ManualLinkCreate,
  graph: Graph,
): "INVALID_LINK_INPUT" | "LINK_EXISTS" | null {
  if (
    !graph.nodes.some((node) => node.event_id === body.from_event_id) ||
    !graph.nodes.some((node) => node.event_id === body.to_event_id)
  )
    return "INVALID_LINK_INPUT";
  if (
    graph.links.some(
      (link) => link.from_event_id === body.from_event_id && link.to_event_id === body.to_event_id,
    )
  )
    return "LINK_EXISTS";
  return null;
}
