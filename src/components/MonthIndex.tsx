import { Link, useLocation } from 'react-router-dom'
import { useCalendarRange } from '../hooks/useCalendarData'
import {
  countByType,
  groupByDate,
  isDateLocked,
  specialDayMap,
} from '../lib/calendar'
import {
  WEEKDAY_LONG,
  daysInMonth,
  endOfMonth,
  formatMonthYear,
  isSameMonth,
  isToday,
  parseMonthKey,
  toISODate,
  weekdayMonFirst,
} from '../lib/dates'
import { CONTENT_TYPE_META, CONTENT_TYPE_ORDER } from '../lib/contentMeta'

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 21 -> "21st", 11 -> "11th". */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** The selected date for a month: the ?d param if valid, else today (if in the
 *  month) or the 1st. Shared by MonthIndex and MonthView so they agree. */
export function selectedDateFor(
  monthKeyStr: string,
  search: string,
  now: Date = new Date(),
): string | null {
  const parsed = parseMonthKey(monthKeyStr)
  if (!parsed) return null
  const { year, month0 } = parsed
  const startISO = toISODate(new Date(year, month0, 1))
  const endISO = toISODate(endOfMonth(new Date(year, month0, 1)))
  const d = new URLSearchParams(search).get('d')
  if (d && d >= startISO && d <= endISO) return d
  return isSameMonth(now, year, month0) ? toISODate(now) : startISO
}

/**
 * The per-month date index shown in the left sidebar: an "Overview" button on
 * top, then every date of the month as "1st October · Thursday". Selecting a
 * date sets ?d= so the centre panel shows that day. Renders nothing off a month
 * route.
 */
export function MonthIndex({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useLocation()
  const match = pathname.match(/^\/month\/(\d{4}-\d{2})/)
  const parsed = match ? parseMonthKey(match[1]) : null

  const monthKeyStr = match ? match[1] : '2000-01'
  const now = new Date()
  const year = parsed?.year ?? 2000
  const month0 = parsed?.month0 ?? 0
  const monthStartISO = toISODate(new Date(year, month0, 1))
  const monthEndISO = toISODate(endOfMonth(new Date(year, month0, 1)))

  // Hooks must run unconditionally; we bail on render below if off a month route.
  const { items, specialDays, locks } = useCalendarRange(
    monthStartISO,
    monthEndISO,
  )

  if (!parsed) return null

  const selected = selectedDateFor(monthKeyStr, search, now)
  const byDate = groupByDate(items)
  const specials = specialDayMap(specialDays)
  const monthName = formatMonthYear(year, month0)
  const count = daysInMonth(year, month0)

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {monthName}
      </div>

      <Link
        to="/grid"
        onClick={onNavigate}
        className="mb-2 flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
      >
        <span aria-hidden className="text-base">
          📸
        </span>
        <span>Overview — the whole feed</span>
      </Link>

      <div className="space-y-1">
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(year, month0, i + 1)
          const iso = toISODate(date)
          const isSel = selected === iso
          const today = isToday(date, now)
          const dayItems = byDate.get(iso) ?? []
          const counts = countByType(dayItems)
          const special = specials.has(iso)
          const locked = isDateLocked(iso, locks)

          return (
            <Link
              key={iso}
              to={`/month/${monthKeyStr}?d=${iso}`}
              onClick={onNavigate}
              aria-current={isSel ? 'true' : undefined}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                isSel
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : special
                    ? 'border-brand-100 bg-brand-50 hover:bg-brand-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-bold ${isSel ? 'text-white' : 'text-slate-900'}`}
                >
                  {ordinal(date.getDate())} {monthName.split(' ')[0]}
                  {today ? (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isSel
                          ? 'bg-white/25 text-white'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      Today
                    </span>
                  ) : null}
                </div>
                <div
                  className={`text-xs ${isSel ? 'text-white/80' : 'text-slate-500'}`}
                >
                  {WEEKDAY_LONG[weekdayMonFirst(date)]}
                </div>
              </div>

              {locked ? (
                <span
                  aria-label="Locked"
                  title="Locked"
                  className={isSel ? 'text-white' : 'text-brand-600'}
                >
                  🔒
                </span>
              ) : null}

              {dayItems.length > 0 ? (
                <div className="flex flex-none items-center gap-1">
                  {CONTENT_TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => (
                    <span
                      key={t}
                      title={`${counts[t]} ${CONTENT_TYPE_META[t].plural}`}
                      className={`h-2 w-2 rounded-full ${
                        isSel ? 'bg-white/80' : CONTENT_TYPE_META[t].dot
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
