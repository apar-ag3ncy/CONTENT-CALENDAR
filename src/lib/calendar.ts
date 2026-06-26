// Derived helpers that turn the raw rows from Supabase into the shapes the
// calendar views need. ISO date strings ('YYYY-MM-DD') sort lexicographically,
// so plain string comparison is safe for range/lock checks.
import type {
  ContentItem,
  SpecialDay,
  PeriodLock,
  ContentType,
} from '../types/database'

export type ItemsByDate = Map<string, ContentItem[]>

export function groupByDate(items: ContentItem[]): ItemsByDate {
  const map: ItemsByDate = new Map()
  for (const it of items) {
    const arr = map.get(it.date)
    if (arr) arr.push(it)
    else map.set(it.date, [it])
  }
  return map
}

export function countByType(items: ContentItem[]): Record<ContentType, number> {
  const counts: Record<ContentType, number> = {
    post: 0,
    reel: 0,
    story: 0,
    caption: 0,
  }
  for (const it of items) counts[it.type] += 1
  return counts
}

export function specialDayMap(days: SpecialDay[]): Map<string, SpecialDay> {
  const map = new Map<string, SpecialDay>()
  for (const d of days) if (!map.has(d.date)) map.set(d.date, d)
  return map
}

export function lockForDate(
  dateISO: string,
  locks: PeriodLock[],
): PeriodLock | null {
  for (const l of locks) {
    if (dateISO >= l.start_date && dateISO <= l.end_date) return l
  }
  return null
}

export function isDateLocked(dateISO: string, locks: PeriodLock[]): boolean {
  return lockForDate(dateISO, locks) !== null
}

/** Distinct dates (within the fetched set) that have at least one item. */
export function distinctPlannedDates(items: ContentItem[]): Set<string> {
  return new Set(items.map((i) => i.date))
}
