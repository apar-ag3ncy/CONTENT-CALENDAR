// -----------------------------------------------------------------------------
// Pure date helpers for a hand-built, Monday→Sunday calendar.
// No external date library. All dates are treated in LOCAL time and formatted
// from local Y/M/D parts (never via toISOString(), which would shift by timezone
// and put content on the wrong day).
// -----------------------------------------------------------------------------

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** 'YYYY-MM-DD' from local date parts. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse 'YYYY-MM-DD' to a local Date at midnight. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** True if the string is a valid 'YYYY-MM-DD'. */
export function isValidISODate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseISODate(s)
  return toISODate(d) === s
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  const r = startOfDay(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Add n months, keeping the day clamped to a valid day of the target month. */
export function addMonths(d: Date, n: number): Date {
  const year = d.getFullYear()
  const month = d.getMonth() + n
  const targetLast = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(d.getDate(), targetLast))
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/** Weekday index with Monday = 0 ... Sunday = 6. */
export function weekdayMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function isWeekend(d: Date): boolean {
  return weekdayMonFirst(d) >= 5
}

/** The Monday on or before the given date. */
export function mondayOf(d: Date): Date {
  return addDays(d, -weekdayMonFirst(d))
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function isSameMonth(d: Date, year: number, month0: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month0
}

export function isToday(d: Date, now: Date = new Date()): boolean {
  return isSameDay(d, now)
}

/**
 * Calendar grid for a month: whole Monday→Sunday weeks covering the month.
 * Includes the trailing days of the previous month and leading days of the
 * next so every row has 7 cells. Length is always a multiple of 7 (28–42).
 */
export function getMonthGridDays(year: number, month0: number): Date[] {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const start = mondayOf(first)
  const end = addDays(mondayOf(last), 6) // Sunday on/after the last day
  const days: Date[] = []
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    days.push(cur)
  }
  return days
}

/** The 7 days (Mon→Sun) of the week containing the given date. */
export function getWeekDays(anyDayInWeek: Date): Date[] {
  const mon = mondayOf(anyDayInWeek)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

// ---- Keys & labels ----------------------------------------------------------

/** 'YYYY-MM' for a date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthKey(
  key: string | undefined,
): { year: number; month0: number } | null {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return null
  const [y, m] = key.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return { year: y, month0: m - 1 }
}

export function formatMonthYear(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatMonthShort(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-US', {
    month: 'short',
  })
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "Jun 22 – 28, 2026" or "Jun 29 – Jul 5, 2026". */
export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const sameYear = monday.getFullYear() === sunday.getFullYear()
  const m1 = monday.toLocaleDateString('en-US', { month: 'short' })
  const m2 = sunday.toLocaleDateString('en-US', { month: 'short' })
  if (sameMonth && sameYear) {
    return `${m1} ${monday.getDate()} – ${sunday.getDate()}, ${sunday.getFullYear()}`
  }
  if (sameYear) {
    return `${m1} ${monday.getDate()} – ${m2} ${sunday.getDate()}, ${sunday.getFullYear()}`
  }
  return `${m1} ${monday.getDate()}, ${monday.getFullYear()} – ${m2} ${sunday.getDate()}, ${sunday.getFullYear()}`
}
