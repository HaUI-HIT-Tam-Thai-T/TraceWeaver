import { z } from "zod";
import { compareUtc, eventSchema, utcSchema } from "../events/schemas.ts";
import type { Event } from "../events/schemas.ts";

const id = z.uuid();
const mode = z.enum(["rule_only", "hybrid"]);
// Integer nanosecond-like units with variable precision; never round API timestamps to milliseconds.
export function utcUnits(value: string, precision: number): bigint {
  const [base = "", fraction = ""] = value.slice(0, -1).split(".");
  return (
    BigInt(Date.parse(`${base}Z`)) * 10n ** BigInt(precision) +
    BigInt(fraction.padEnd(precision + 3, "0"))
  );
}
export function shiftUtc(value: string, seconds: number): string {
  const [base = "", fraction] = value.slice(0, -1).split(".");
  const shifted = new Date(Date.parse(`${base}Z`) + seconds * 1000).toISOString().slice(0, 19);
  return `${shifted}${fraction === undefined ? "" : `.${fraction}`}Z`;
}
export const runCreateSchema = z
  .strictObject({
    root_event_id: id,
    source_ids: z
      .array(id)
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "Nguồn không được lặp."),
    window: z.strictObject({ from: utcSchema, to: utcSchema }),
    mode,
  })
  .superRefine(({ window }, ctx) => {
    const precision = Math.max(
      window.from.slice(0, -1).split(".")[1]?.length ?? 0,
      window.to.slice(0, -1).split(".")[1]?.length ?? 0,
    );
    if (
      compareUtc(window.from, window.to) > 0 ||
      utcUnits(window.to, precision) - utcUnits(window.from, precision) >
        3600000n * 10n ** BigInt(precision)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["window", "to"],
        message: "Khoảng thời gian phải theo thứ tự và không quá một giờ.",
      });
    }
  });
export function validateRoot(body: RunCreate, root: Event): boolean {
  return (
    body.root_event_id === root.event_id &&
    body.source_ids.includes(root.source_id) &&
    compareUtc(body.window.from, root.occurred_at) <= 0 &&
    compareUtc(root.occurred_at, body.window.to) <= 0
  );
}
export const runSchema = z.strictObject({
  id,
  status: z.enum(["queued", "running", "completed", "failed"]),
  mode,
  root_event_id: id,
  input_snapshot_id: id,
  rule_version: z.string().min(1).max(100),
  model_version: z.string().min(1).max(100).nullable(),
  created_at: utcSchema,
  completed_at: utcSchema.nullable(),
  degraded: z.boolean(),
  degraded_reason: z.string().min(1).max(200).nullable(),
  effective_method: mode,
  error: z
    .strictObject({
      code: z.string().min(1).max(100),
      message: z.string().min(1).max(1000),
    })
    .nullable(),
});
const uniqueIds = z.array(id).refine((ids) => new Set(ids).size === ids.length);
const evidenceSchema = z.strictObject({
  reason_code: z.string().min(1).max(100),
  event_ids: uniqueIds.refine((ids) => ids.length > 0),
  field: z.string().min(1).max(200),
  observed_values: z.array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])),
});
export const linkSchema = z.strictObject({
  id,
  from_event_id: id,
  to_event_id: id,
  method: z.enum(["rule", "model", "manual"]),
  score: z.number().finite().min(0).max(1).nullable(),
  evidence: z.array(evidenceSchema).min(1),
  review_state: z.enum(["pending", "accepted", "rejected"]),
  version: z.number().int().min(1),
});
export type Link = z.infer<typeof linkSchema>;
export const graphSchema = z
  .strictObject({
    run_id: id,
    nodes: z.array(eventSchema),
    links: z.array(linkSchema),
    unresolved_event_ids: uniqueIds,
    missing_expected_steps: z.array(
      z.strictObject({
        step: z.string().min(1).max(100),
        process_template_version: z.string().min(1).max(100),
        label: z.literal("chưa có bằng chứng"),
      }),
    ),
    abstentions: z
      .array(
        z
          .strictObject({
            reason_code: z.string(),
            event_id: id.optional(),
            transition_id: z.string().optional(),
            from_event_id: id.optional(),
            to_event_id: id.optional(),
          })
          .refine(
            (value) =>
              value.event_id !== undefined ||
              (value.transition_id !== undefined &&
                value.from_event_id !== undefined &&
                value.to_event_id !== undefined),
          ),
      )
      .default([]),
    version: z.number().int().min(1),
  })
  .refine((graph) => {
    const nodes = new Set(graph.nodes.map((node) => node.event_id));
    return (
      nodes.size === graph.nodes.length &&
      new Set(graph.links.map((link) => link.id)).size === graph.links.length &&
      graph.unresolved_event_ids.every((id) => nodes.has(id)) &&
      graph.links.every(
        (link) =>
          nodes.has(link.from_event_id) &&
          nodes.has(link.to_event_id) &&
          link.evidence.every((item) => item.event_ids.every((id) => nodes.has(id))),
      )
    );
  });
export type RunCreate = z.infer<typeof runCreateSchema>;
export type Run = z.infer<typeof runSchema>;
export type Graph = z.infer<typeof graphSchema>;
