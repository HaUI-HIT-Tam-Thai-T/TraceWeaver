import { apiClient } from "../../../services/apiClient";
import { createEventsService } from "./createEventsService";

export const eventsService = createEventsService(apiClient);
export const { listEvents, getEvent } = eventsService;
