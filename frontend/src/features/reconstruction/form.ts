import { z } from "zod";
import { localToUtc, utcToLocalInput } from "../events/query.ts";
import { runCreateSchema, shiftUtc, validateRoot } from "./schemas.ts";
import type { Event } from "../events/schemas.ts";

export function inputToUtc(value: string): string {
  const fraction = /\.\d+$/.exec(value)?.[0] ?? "";
  return (
    localToUtc(value.slice(0, value.length - fraction.length)).slice(0, -1) +
    fraction +
    "Z"
  );
}
const formBase = z.object({
  source_ids: z.array(z.uuid()).min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  mode: z.enum(["rule_only", "hybrid"]),
});
export type RunFormValues = z.infer<typeof formBase>;
export function toRunBody(value: RunFormValues, root: Event) {
  return runCreateSchema.parse({
    root_event_id: root.event_id,
    source_ids: value.source_ids,
    window: { from: inputToUtc(value.from), to: inputToUtc(value.to) },
    mode: value.mode,
  });
}
export function runFormSchema(root: Event) {
  return formBase.superRefine((value, ctx) => {
    try {
      if (!validateRoot(toRunBody(value, root), root))
        throw new Error("Invalid root");
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message:
          "Window phải chứa root, không quá một giờ; nguồn phải duy nhất và chứa nguồn root.",
      });
    }
  });
}
export function runFormDefaults(root: Event): RunFormValues {
  return {
    source_ids: [root.source_id],
    from: utcToLocalInput(shiftUtc(root.occurred_at, -300)),
    to: utcToLocalInput(shiftUtc(root.occurred_at, 300)),
    mode: "rule_only",
  };
}
