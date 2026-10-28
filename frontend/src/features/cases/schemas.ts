import { z } from "zod";
import { compareUtc, utcSchema } from "../events/schemas.ts";

const id = z.uuid();
const subject = z.string().min(1).max(255);
export const caseStateSchema = z.enum([
  "new",
  "assigned",
  "investigating",
  "awaiting_verification",
  "closed",
]);
export const caseCreateSchema = z.strictObject({
  run_id: id,
  title: z
    .string()
    .trim()
    .min(1, "Nhập tiêu đề có nội dung.")
    .max(300, "Tiêu đề tối đa 300 ký tự."),
});
export const caseSchema = z.strictObject({
  id,
  workspace_id: id,
  run_id: id,
  workflow_instance_id: id,
  title: z.string().min(1).max(300).regex(/\S/),
  creator_subject: subject,
  owner_id: subject.nullable(),
  state: caseStateSchema,
  version: z.number().int().min(1),
  created_at: utcSchema,
  updated_at: utcSchema,
});
const uniqueIds = z.array(id).refine((ids) => new Set(ids).size === ids.length);
export const historySchema = z.strictObject({
  action: z.string().min(1).max(100),
  from_state: z.string().min(1).max(100).nullable(),
  to_state: z.string().min(1).max(100),
  actor_subject: subject,
  reason: z.string().min(1).max(1000).regex(/\S/),
  version: z.number().int().min(1),
  occurred_at: utcSchema,
  evidence_refs: uniqueIds,
});
export const evidenceSchema = z.strictObject({
  id,
  case_id: id,
  kind: z.enum(["events", "note"]),
  event_ids: uniqueIds,
  note: z.string().max(10000),
  creator_subject: subject,
  created_at: utcSchema,
});
export const evidenceCreateSchema = z.strictObject({
  kind: z.enum(['events', 'note']),
  event_ids: z.array(id).max(1000, 'Chọn tối đa 1.000 events.').refine(ids => new Set(ids).size === ids.length, 'Event không được lặp.'),
  note: z.string().max(10000, 'Note tối đa 10.000 ký tự.'),
}).superRefine((body, ctx) => {
  if (body.kind === 'events' && body.event_ids.length === 0) ctx.addIssue({ code: 'custom', path: ['event_ids'], message: 'Chọn ít nhất một event trong snapshot.' });
  if (body.kind === 'note' && !/\S/.test(body.note)) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Nhập note có nội dung.' });
});
export type EvidenceCreate = z.infer<typeof evidenceCreateSchema>;
export const caseDetailSchema = z
  .strictObject({
    case: caseSchema,
    history: z.array(historySchema),
    evidence: z.array(evidenceSchema),
  })
  .refine(
    (detail) =>
      new Set(detail.evidence.map((item) => item.id)).size ===
        detail.evidence.length &&
      detail.evidence.every((item) => item.case_id === detail.case.id),
  );
export const casesPageSchema = z.strictObject({
  items: z
    .array(caseSchema)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
    ),
  next_cursor: z.string().min(1).max(4096).nullable(),
});
export const caseFiltersSchema = z
  .strictObject({
    state: caseStateSchema.optional(),
    owner_id: subject.optional(),
    from: utcSchema.optional(),
    to: utcSchema.optional(),
    limit: z.number().int().min(1).max(100),
  })
  .refine(
    (value) =>
      !value.from || !value.to || compareUtc(value.from, value.to) <= 0,
    {
      path: ["to"],
      message: "Thời gian kết thúc phải bằng hoặc sau thời gian bắt đầu.",
    },
  );
export type Case = z.infer<typeof caseSchema>;
export type WorkflowHistory = z.infer<typeof historySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CaseCreate = z.infer<typeof caseCreateSchema>;
export type CaseDetail = z.infer<typeof caseDetailSchema>;
export type CaseFilters = z.infer<typeof caseFiltersSchema>;
export type CasesPage = z.infer<typeof casesPageSchema>;
