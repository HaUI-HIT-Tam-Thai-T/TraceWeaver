import { z } from "zod";

const version = z.number().int().min(1);
const id = z.uuid();
const utc = z.iso.datetime({ offset: true });
const text = z.string().min(1);
export const resultSchema = z.enum(["passed", "failed", "inconclusive"]);
export const checkSchema = z.strictObject({
  step: z.enum(["ram", "image", "account"]),
  passed: z.boolean(),
  reason: z.string(),
});
export const attemptSchema = z.strictObject({
  id,
  operation_id: text.max(200),
  number: version,
  at: utc,
  source_version: version,
  checker_version: z.literal("lab-state-2"),
  result: z.enum(["passed", "failed"]),
  reason: z.string().nullable(),
  blockers: z.array(z.string()),
  checks: z
    .array(checkSchema)
    .length(3)
    .refine((items) => new Set(items.map((item) => item.step)).size === 3),
  required_ram: version,
  available_ram: z.number().int().min(0),
  image_id: text,
  account_id: text,
  image_available: z.boolean(),
  account_active: z.boolean(),
});
// Legacy snapshots are only presented as historical data, never as current proof.
const legacyAttempt = z
  .object({ checker_version: z.string().optional() })
  .catchall(z.unknown())
  .refine((value) => value.checker_version !== "lab-state-2");
export const historicalAttemptSchema = z.union([attemptSchema, legacyAttempt]);
export const observationSchema = z.strictObject({
  result: resultSchema,
  reason: z.string().nullable().optional(),
  source: z.string().optional(),
  simulated: z.literal(true).optional(),
  checker_version: z.string().optional(),
  source_version: version.optional(),
  request_id: text.optional(),
  conditions: z
    .strictObject({
      required_ram: version,
      image_id: text,
      account_id: text,
      image_available: z.boolean(),
      account_active: z.boolean(),
    })
    .optional(),
  attempts: z.array(historicalAttemptSchema).optional(),
  attempt: historicalAttemptSchema.nullable().optional(),
  environment: z.record(z.string(), z.unknown()).nullable().optional(),
  delivery: z
    .strictObject({
      status: z.enum(["pending", "delivered"]),
      total: z.number().int().min(0),
      delivered: z.number().int().min(0),
    })
    .refine(
      (value) =>
        value.delivered <= value.total &&
        (value.status !== "delivered" || value.delivered === value.total),
    )
    .optional(),
});
export const sandboxSchema = z.strictObject({
  case_id: id,
  case_version: version,
  observation: observationSchema,
  execution: z
    .strictObject({ replayed: z.boolean(), operation_id: text, attempt: attemptSchema })
    .refine((value) => value.operation_id === value.attempt.operation_id)
    .optional(),
});
export const proofSchema = z.strictObject({
  id,
  case_id: id,
  case_version: version,
  actor_subject: text,
  checked_at: utc,
  observation: observationSchema,
});
export const proofsSchema = z
  .strictObject({ case_id: id, case_version: version, items: z.array(proofSchema) })
  .refine(
    (value) =>
      value.items.every((item) => item.case_id === value.case_id) &&
      new Set(value.items.map((item) => item.id)).size === value.items.length,
  );
// /lab includes requests/events. Project only documented capacity fields here.
export const labSchema = z.object({ version, ram: z.number().int().min(0).max(1048576) });
const versions = { expected_case_version: version, expected_version: version };
export const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("capacity"),
    ram: z.number().int().min(0).max(1048576),
    ...versions,
  }),
  z.strictObject({
    action: z.literal("image"),
    image_id: text.max(220),
    available: z.boolean(),
    ...versions,
  }),
  z.strictObject({
    action: z.literal("account"),
    account_id: text.max(220),
    active: z.boolean(),
    ...versions,
  }),
  z.strictObject({ action: z.literal("provision"), operation_id: z.uuid(), ...versions }),
]);
export type Sandbox = z.infer<typeof sandboxSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type HistoricalAttempt = z.infer<typeof historicalAttemptSchema>;
export type Proof = z.infer<typeof proofSchema>;
export type Proofs = z.infer<typeof proofsSchema>;
export type Lab = z.infer<typeof labSchema>;
export type Command = z.infer<typeof commandSchema>;
