import { createContext, useContext } from 'react'
import type { EventFilters } from './schemas'
import type { EventsState } from './state'

export type EventsContextValue = {
  state: EventsState
  setFilters: (filters: EventFilters) => void
  showEvent: (id: string | null) => void
  refresh: () => void
  previousPage: () => void
  nextPage: () => void
  retryDetail: () => void
  selectRoot: () => boolean
  clearRoot: () => void
}

export const EventsContext = createContext<EventsContextValue | undefined>(undefined)
export function useEvents() {
  const value = useContext(EventsContext)
  if (!value) throw new Error('useEvents must be used inside EventsProvider')
  return value
}
