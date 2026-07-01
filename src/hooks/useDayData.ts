// Data for a single Day page: that day's content items and its day-level note.
// Reads from the SQLite API when configured, else the read-only demo seed.
import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DEMO_MODE, demoItemsForDate } from '../lib/demoData'
import { api } from '../lib/api'
import type { ContentItem, DayNote } from '../types/database'

// On the live (shared-host) API the FIRST content fetch right after opening a
// day occasionally fails or comes back empty — which would render "Nothing
// planned" for a day that actually has posts. So we auto-refetch a day's content
// up to MAX_DAY_FETCH_ATTEMPTS times until content arrives, then stop. The moment
// content shows up we never refetch again; a genuinely empty day simply uses up
// its attempts and then shows the empty state.
const MAX_DAY_FETCH_ATTEMPTS = 5
const DAY_REFETCH_DELAY_MS = 450

export function useDayItems(dateISO: string) {
  const query = useQuery({
    queryKey: ['day_items', dateISO],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return demoItemsForDate(dateISO)
      return api.contentByDate(dateISO)
    },
    // Transient network/server hiccups on a single request shouldn't surface as
    // an empty day — retry a couple of times within the request itself too.
    retry: 2,
    retryDelay: (n) => Math.min(400 * 2 ** n, 2000),
  })

  // Attempt counter (the initial fetch is attempt #1), reset when the day changes.
  const attempts = useRef({ date: dateISO, count: 1 })
  if (attempts.current.date !== dateISO) {
    attempts.current = { date: dateISO, count: 1 }
  }

  const { data, isFetching, isPending, isError, refetch } = query
  const hasContent = (data?.length ?? 0) > 0

  useEffect(() => {
    if (hasContent) {
      // Got the content → never auto-refetch the remaining attempts.
      attempts.current.count = MAX_DAY_FETCH_ATTEMPTS
      return
    }
    if (isPending || isFetching) return // a fetch is already in flight
    if (attempts.current.count >= MAX_DAY_FETCH_ATTEMPTS) return // gave it 5 tries
    const id = window.setTimeout(() => {
      attempts.current.count += 1
      refetch()
    }, DAY_REFETCH_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [dateISO, hasContent, isFetching, isPending, refetch])

  // Manual "try again" — start a fresh round of attempts.
  const retry = useCallback(() => {
    attempts.current.count = 1
    refetch()
  }, [refetch])

  const exhausted = !isFetching && attempts.current.count >= MAX_DAY_FETCH_ATTEMPTS
  return {
    ...query,
    items: data ?? [],
    /** Still loading or mid auto-retry — keep showing the wireframe. */
    isResolving: !hasContent && !exhausted,
    /** All attempts used and the last one errored (vs. a genuinely empty day). */
    failed: exhausted && !hasContent && isError,
    /** Which attempt we're on (1…MAX), for a subtle "still loading" hint. */
    attempt: Math.min(attempts.current.count, MAX_DAY_FETCH_ATTEMPTS),
    maxAttempts: MAX_DAY_FETCH_ATTEMPTS,
    retry,
  }
}

export function useDayNote(dateISO: string) {
  return useQuery({
    queryKey: ['day_note', dateISO],
    queryFn: async (): Promise<DayNote | null> => {
      if (DEMO_MODE) return null
      return api.dayNote(dateISO)
    },
    retry: 2,
  })
}
