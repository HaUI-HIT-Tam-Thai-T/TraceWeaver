import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '../../services/apiError.ts'
import { eventSchema, eventsPageSchema, filtersSchema } from './schemas.ts'
import type { Event, EventFilters, EventsPage } from './schemas.ts'

function invalid(code: string) {
  return new ApiError({ kind: 'client', code, message: 'Dữ liệu hoặc tham số event không hợp lệ.' })
}

export function createEventsService(client: Pick<AxiosInstance, 'get'>) {
  async function listEvents(workspaceId: string, filters: EventFilters, options: { signal?: AbortSignal; cursor?: string } = {}): Promise<EventsPage> {
    const parsed = filtersSchema.safeParse(filters)
    if (!z.uuid().safeParse(workspaceId).success || !parsed.success ||
      (options.cursor !== undefined && !z.string().min(1).max(4096).safeParse(options.cursor).success)) throw invalid('INVALID_EVENT_QUERY')
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) params.set(key, String(value))
    if (options.cursor !== undefined) params.set('cursor', options.cursor)
    const response = await client.get<unknown>(`/api/v1/workspaces/${workspaceId}/events`, { params, signal: options.signal })
    const result = eventsPageSchema.safeParse(response.data)
    if (!result.success || (filters.source_id && result.data.items.some((item) => item.source_id !== filters.source_id))) throw invalid('INVALID_API_RESPONSE')
    return result.data
  }

  async function getEvent(workspaceId: string, eventId: string, signal?: AbortSignal): Promise<Event> {
    if (!z.uuid().safeParse(workspaceId).success || !z.uuid().safeParse(eventId).success) throw invalid('INVALID_EVENT_QUERY')
    const response = await client.get<unknown>(`/api/v1/workspaces/${workspaceId}/events/${eventId}`, { signal })
    const result = eventSchema.safeParse(response.data)
    if (!result.success || result.data.event_id !== eventId) throw invalid('INVALID_API_RESPONSE')
    return result.data
  }
  return { listEvents, getEvent }
}

export type EventsService = ReturnType<typeof createEventsService>
