import type { z } from "zod";
import type { eventSchema, eventsPageSchema, filtersSchema } from "../features/events/schemas.ts";

export type Event = z.infer<typeof eventSchema>;
export type EventsPage = z.infer<typeof eventsPageSchema>;
export type EventFilters = z.infer<typeof filtersSchema>;
