import { Link, Navigate, useParams } from 'react-router-dom'
import { CalendarToolbar } from '../components/CalendarToolbar'
import { LockPill } from '../components/LockIndicators'
import { FinalizeBar } from '../components/FinalizeBar'
import { StatusChip, TypeChip } from '../components/ContentBadges'
import { isFirebaseConfigured } from '../lib/firebase'
import { useCalendarRange } from '../hooks/useCalendarData'
import { groupByDate, isDateLocked, specialDayMap } from '../lib/calendar'
import {
  WEEKDAY_LONG,
  addDays,
  formatWeekRange,
  getWeekDays,
  isToday,
  isValidISODate,
  mondayOf,
  parseISODate,
  toISODate,
  weekdayMonFirst,
} from '../lib/dates'
import type { ContentItem, SpecialDay } from '../types/database'

function WeekDayColumn({
  date,
  today,
  items,
  special,
  locked,
}: {
  date: Date
  today: boolean
  items: ContentItem[]
  special: SpecialDay | undefined
  locked: boolean
}) {
  const iso = toISODate(date)
  const dow = weekdayMonFirst(date)
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white ${
        today ? 'border-brand-400 ring-1 ring-brand-300' : 'border-slate-200'
      }`}
    >
      <Link
        to={`/day/${iso}`}
        className={`flex items-center justify-between gap-2 rounded-t-2xl px-3 py-2 ${
          special ? 'bg-brand-100' : 'bg-slate-50'
        }`}
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {WEEKDAY_LONG[dow]}
          </div>
          <div className="text-lg font-bold text-slate-900">
            {date.getDate()}
            <span className="ml-1 text-xs font-medium text-slate-400">
              {date.toLocaleDateString('en-US', { month: 'short' })}
            </span>
          </div>
        </div>
        {locked ? <LockPill /> : null}
      </Link>

      {special ? (
        <div className="border-b border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-900">
          {special.label}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 ? (
          <p className="px-1 py-2 text-xs text-slate-400">Nothing planned</p>
        ) : (
          items.map((it) => (
            <Link
              key={it.id}
              to={`/day/${iso}`}
              className="block rounded-lg border border-slate-200 p-2 transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex items-center justify-between gap-1">
                <TypeChip type={it.type} />
                <StatusChip status={it.status} />
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">
                {it.title || '(untitled)'}
              </div>
            </Link>
          ))
        )}

        {!locked ? (
          <Link
            to={`/day/${iso}?add=1`}
            className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 px-2 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            + Add
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export default function WeekView() {
  const { weekStart } = useParams()
  const now = new Date()
  const valid = isValidISODate(weekStart)

  // Normalise to the Monday of whatever date was passed (or this week as a
  // fallback) so hooks always run; redirect after the hooks if it was invalid.
  const monday = mondayOf(valid ? parseISODate(weekStart) : now)
  const days = getWeekDays(monday)
  const startISO = toISODate(days[0])
  const endISO = toISODate(days[6])

  const { items, specialDays, locks, isFetching } = useCalendarRange(
    startISO,
    endISO,
  )
  const byDate = groupByDate(items)
  const specials = specialDayMap(specialDays)
  const refDate = now >= days[0] && now <= addDays(days[6], 1) ? now : monday

  if (!valid) {
    return <Navigate to={`/week/${toISODate(mondayOf(now))}`} replace />
  }

  return (
    <div className="space-y-4">
      <CalendarToolbar
        view="week"
        title={formatWeekRange(monday)}
        subtitle={isFetching ? 'Updating…' : 'Week view'}
        prevTo={`/week/${toISODate(addDays(monday, -7))}`}
        nextTo={`/week/${toISODate(addDays(monday, 7))}`}
        todayTo={`/week/${toISODate(mondayOf(now))}`}
        refDate={refDate}
      />

      <FinalizeBar
        scope="week"
        label="week"
        startISO={startISO}
        endISO={endISO}
        locks={locks}
        canEdit={isFirebaseConfigured}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((date) => {
          const iso = toISODate(date)
          return (
            <WeekDayColumn
              key={iso}
              date={date}
              today={isToday(date, now)}
              items={byDate.get(iso) ?? []}
              special={specials.get(iso)}
              locked={isDateLocked(iso, locks)}
            />
          )
        })}
      </div>
    </div>
  )
}
