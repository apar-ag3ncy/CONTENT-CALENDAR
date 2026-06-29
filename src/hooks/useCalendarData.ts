// React Query hooks that fetch calendar data for a date range. Reads from the
// MongoDB API when configured, else the read-only demo seed (empty for the
// collections the demo doesn't cover).
import { useQuery } from '@tanstack/react-query'
import { DEMO_MODE, demoItemsInRange } from '../lib/demoData'
import { api } from '../lib/api'
import type { ContentItem, SpecialDay, PeriodLock } from '../types/database'

const EMPTY: never[] = []

export function useContentItems(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['content_items', startISO, endISO],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return demoItemsInRange(startISO, endISO)
      return api.contentRange(startISO, endISO)
    },
  })
}

export function useSpecialDays(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['special_days', startISO, endISO],
    queryFn: async (): Promise<SpecialDay[]> => {
      if (DEMO_MODE) return []
      return api.specialDays(startISO, endISO)
    },
  })
}

export function usePeriodLocks(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['period_locks', startISO, endISO],
    queryFn: async (): Promise<PeriodLock[]> => {
      if (DEMO_MODE) return []
      return api.locks(startISO, endISO)
    },
  })
}

/** Convenience: fetch items + special days + locks for one range together. */
export function useCalendarRange(startISO: string, endISO: string) {
  const items = useContentItems(startISO, endISO)
  const specialDays = useSpecialDays(startISO, endISO)
  const locks = usePeriodLocks(startISO, endISO)

  return {
    items: items.data ?? (EMPTY as ContentItem[]),
    specialDays: specialDays.data ?? (EMPTY as SpecialDay[]),
    locks: locks.data ?? (EMPTY as PeriodLock[]),
    isLoading: items.isLoading || specialDays.isLoading || locks.isLoading,
    isFetching: items.isFetching || specialDays.isFetching || locks.isFetching,
    error: items.error ?? specialDays.error ?? locks.error ?? null,
  }
}
