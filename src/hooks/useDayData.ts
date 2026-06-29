// Data for a single Day page: that day's content items and its day-level note.
// Reads from the MongoDB API when configured, else the read-only demo seed.
import { useQuery } from '@tanstack/react-query'
import { DEMO_MODE, demoItemsForDate } from '../lib/demoData'
import { api } from '../lib/api'
import type { ContentItem, DayNote } from '../types/database'

export function useDayItems(dateISO: string) {
  return useQuery({
    queryKey: ['day_items', dateISO],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return demoItemsForDate(dateISO)
      return api.contentByDate(dateISO)
    },
  })
}

export function useDayNote(dateISO: string) {
  return useQuery({
    queryKey: ['day_note', dateISO],
    queryFn: async (): Promise<DayNote | null> => {
      if (DEMO_MODE) return null
      return api.dayNote(dateISO)
    },
  })
}
