import { z } from "zod";
import { filtersSchema } from "./schemas.ts";
import type { EventFilters } from "./schemas.ts";

const filterKeys = ["source_id", "from", "to", "action", "q"] as const;
const knownKeys = [...filterKeys, "limit", "event_id"];

export type EventQuery =
  | { success: false }
  | { success: true; filters: EventFilters; eventId: string | null };

export function readEventQuery(search: string): EventQuery {
  const params = new URLSearchParams(search);
  if (knownKeys.some((key) => params.getAll(key).length > 1))
    return { success: false };
  const result = filtersSchema.safeParse({
    ...Object.fromEntries(
      filterKeys.flatMap((key) =>
        params.has(key) ? [[key, params.get(key)]] : [],
      ),
    ),
    limit: params.has("limit") ? Number(params.get("limit")) : 50,
  });
  const eventId = params.get("event_id");
  if (
    !result.success ||
    ![25, 50, 100].includes(result.data.limit) ||
    (eventId !== null && !z.uuid().safeParse(eventId).success)
  ) {
    return { success: false };
  }
  return { success: true, filters: result.data, eventId };
}

// The path owns the detail ID; query parameters retain only the list filters.
export function readEventLocation(search: string, eventId: string | null): EventQuery {
  const params = new URLSearchParams(search);
  if (eventId !== null) params.set("event_id", eventId);
  return readEventQuery(params.toString());
}

export function writeEventQuery(
  filters: EventFilters,
  eventId: string | null = null,
) {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value !== undefined) params.set(key, value);
  }
  params.set("limit", String(filters.limit));
  if (eventId) params.set("event_id", eventId);
  return params;
}

// Only form input is converted. API event timestamps are always retained verbatim.
export function localToUtc(value: string): string {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(\.\d{1,6})?)?$/.exec(value);
  if (!match) throw new Error("Invalid local time");
  const base = `${match[1]}:${match[2] ?? "00"}`;
  const date = new Date(`${base}+07:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19) !== base
  ) {
    throw new Error("Invalid local time");
  }
  return `${date.toISOString().slice(0, 19)}${match[3] ?? ""}Z`;
}

export function utcToLocalInput(value: string | undefined): string {
  if (!value) return "";
  const base = new Date(new Date(value).getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 19);
  const fraction = /\.\d+Z$/.exec(value)?.[0].slice(0, -1) ?? "";
  return base + fraction;
}

const localTimeSchema = z.string().refine((value) => {
  if (!value) return true;
  try {
    localToUtc(value);
    return true;
  } catch {
    return false;
  }
}, "Thời gian không hợp lệ.");

const eventFormBase = z.object({
  source_id: z.union([z.literal(""), z.uuid()]),
  from: localTimeSchema,
  to: localTimeSchema,
  action: z.string().max(200),
  q: z.string().max(500),
  limit: z.enum(["25", "50", "100"]),
});
export type EventFormValues = z.infer<typeof eventFormBase>;

export const eventFormSchema = eventFormBase.refine(
  (value) => {
    if (!value.from || !value.to) return true;
    try {
      return filtersSchema.safeParse(formToFilters(value)).success;
    } catch {
      return false;
    }
  },
  { path: ["to"], message: "Kiểm tra lại khoảng thời gian." },
);

export function formToFilters(value: EventFormValues): EventFilters {
  return filtersSchema.parse({
    ...(value.source_id ? { source_id: value.source_id } : {}),
    ...(value.from ? { from: localToUtc(value.from) } : {}),
    ...(value.to ? { to: localToUtc(value.to) } : {}),
    ...(value.action ? { action: value.action } : {}),
    ...(value.q ? { q: value.q } : {}),
    limit: Number(value.limit),
  });
}

export function formDefaults(filters: EventFilters): EventFormValues {
  return {
    source_id: filters.source_id ?? "",
    from: utcToLocalInput(filters.from),
    to: utcToLocalInput(filters.to),
    action: filters.action ?? "",
    q: filters.q ?? "",
    limit: filters.limit === 25 ? "25" : filters.limit === 100 ? "100" : "50",
  };
}
