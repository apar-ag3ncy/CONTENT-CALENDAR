// React Query hooks that fetch calendar data from Firestore for a date range.
// When Firebase isn't configured yet, queries are disabled and the views fall
// back to empty arrays so the calendar still renders (an empty preview).
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { DEMO_MODE, demoItemsInRange } from '../lib/demoData'
import type { ContentItem, SpecialDay, PeriodLock } from '../types/database'

const EMPTY: never[] = []

export function useContentItems(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['content_items', startISO, endISO],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return demoItemsInRange(startISO, endISO)
      const snap = await getDocs(
        query(
          collection(db, 'content_items'),
          where('date', '>=', startISO),
          where('date', '<=', endISO),
        ),
      )
      const items = snap.docs.map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) } as ContentItem),
      )
      // date asc, then grid_position asc (nulls last), then created_at asc.
      items.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        const ag = a.grid_position
        const bg = b.grid_position
        if (ag !== bg) {
          if (ag == null) return 1
          if (bg == null) return -1
          return ag - bg
        }
        const ac = a.created_at ?? ''
        const bc = b.created_at ?? ''
        if (ac !== bc) return ac < bc ? -1 : 1
        return 0
      })
      return items
    },
  })
}

export function useSpecialDays(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['special_days', startISO, endISO],
    queryFn: async (): Promise<SpecialDay[]> => {
      if (DEMO_MODE) return []
      const snap = await getDocs(
        query(
          collection(db, 'special_days'),
          where('date', '>=', startISO),
          where('date', '<=', endISO),
        ),
      )
      const days = snap.docs.map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) } as SpecialDay),
      )
      // date + created_at gives a stable order when two specials share a day,
      // so specialDayMap() deterministically keeps the earliest-created one.
      days.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        const ac = a.created_at ?? ''
        const bc = b.created_at ?? ''
        if (ac !== bc) return ac < bc ? -1 : 1
        return 0
      })
      return days
    },
  })
}

export function usePeriodLocks(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['period_locks', startISO, endISO],
    queryFn: async (): Promise<PeriodLock[]> => {
      if (DEMO_MODE) return []
      // Any lock that overlaps [startISO, endISO]. Firestore can't range two
      // fields, so filter start_date <= endISO in the query and end_date >=
      // startISO in JS.
      const snap = await getDocs(
        query(
          collection(db, 'period_locks'),
          where('start_date', '<=', endISO),
        ),
      )
      return snap.docs
        .map(
          (d) =>
            ({ id: d.id, ...(d.data() as Record<string, unknown>) } as PeriodLock),
        )
        .filter((l) => l.end_date >= startISO)
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
