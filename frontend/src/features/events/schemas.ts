import { z } from "zod";

export const utcSchema = z.iso.datetime().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
const idSchema = z.uuid();
export const eventSchema = z.strictObject({
  event_id: idSchema,
  source_id: idSchema,
  source_event_id: z.string().min(1).max(200),
  occurred_at: utcSchema,
  received_at: utcSchema,
  service: z.string().min(1).max(100),
  action: z.string().min(1).max(200),
  outcome: z.enum(["success", "failed", "unknown"]),
  identifiers: z.array(
    z.strictObject({
      namespace: z.string().min(1).max(100),
      value: z.string().min(1).max(500),
    }),
  ),
  message: z.string().max(4096),
  payload_redacted: z.record(z.string(), z.unknown()),
  parser_version: z.string().min(1).max(100),
  provenance: z.strictObject({
    batch_id: idSchema,
    locator: z.string().min(1).max(500),
    sha256_redacted: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export const eventsPageSchema = z.strictObject({
  items: z
    .array(eventSchema)
    .refine((items) => new Set(items.map((item) => item.event_id)).size === items.length),
  next_cursor: z.string().min(1).max(4096).nullable(),
});

export function compareUtc(a: string, b: string): number {
  const [secondsA, fractionA = ""] = a.slice(0, -1).split(".");
  const [secondsB, fractionB = ""] = b.slice(0, -1).split(".");
  const length = Math.max(fractionA.length, fractionB.length);
  const keyA = `${secondsA}.${fractionA.padEnd(length, "0")}`;
  const keyB = `${secondsB}.${fractionB.padEnd(length, "0")}`;
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
}

export const filtersSchema = z
  .strictObject({
    source_id: idSchema.optional(),
    from: utcSchema.optional(),
    to: utcSchema.optional(),
    action: z.string().min(1).max(200).optional(),
    q: z.string().min(1).max(500).optional(),
    limit: z.number().int().min(1).max(100),
  })
  .refine((value) => !value.from || !value.to || compareUtc(value.from, value.to) <= 0, {
    path: ["to"],
    message: "Thời gian kết thúc phải bằng hoặc sau thời gian bắt đầu.",
  });
