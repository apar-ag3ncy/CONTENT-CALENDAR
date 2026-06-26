import { Link, Navigate, useParams } from 'react-router-dom'
import { CalendarToolbar } from '../components/CalendarToolbar'
import { useContentItems, useSpecialDays } from '../hooks/useCalendarData'
import { daysInMonth, formatMonthShort, monthKey } from '../lib/dates'

function FillBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function YearView() {
  const { year: yearParam } = useParams()
  const now = new Date()
  const parsedYear = yearParam ? Number(yearParam) : now.getFullYear()
  // `/year` (no param) is valid and shows the current year; only a *present but
  // invalid* param redirects. Compute a safe year so hooks always run first.
  const paramInvalid =
    yearParam !== undefined &&
    (!Number.isInteger(parsedYear) || parsedYear < 1970 || parsedYear > 9999)
  const year = paramInvalid ? now.getFullYear() : parsedYear

  const startISO = `${year}-01-01`
  const endISO = `${year}-12-31`
  const itemsQ = useContentItems(startISO, endISO)
  const specialsQ = useSpecialDays(startISO, endISO)
  const items = itemsQ.data ?? []
  const specials = specialsQ.data ?? []

  // Aggregate per month.
  const plannedDays = Array.from({ length: 12 }, () => new Set<string>())
  const itemCount = new Array(12).fill(0)
  for (const it of items) {
    const mo = Number(it.date.slice(5, 7)) - 1
    if (mo >= 0 && mo < 12) {
      plannedDays[mo].add(it.date)
      itemCount[mo] += 1
    }
  }
  const specialCount = new Array(12).fill(0)
  for (const d of specials) {
    const mo = Number(d.date.slice(5, 7)) - 1
    if (mo >= 0 && mo < 12) specialCount[mo] += 1
  }

  const refDate = year === now.getFullYear() ? now : new Date(year, 0, 1)

  if (paramInvalid) {
    return <Navigate to={`/year/${now.getFullYear()}`} replace />
  }

  return (
    <div className="space-y-4">
      <CalendarToolbar
        view="year"
        title={String(year)}
        subtitle={itemsQ.isFetching ? 'Updating…' : 'Year overview'}
        prevTo={`/year/${year - 1}`}
        nextTo={`/year/${year + 1}`}
        todayTo={`/year/${now.getFullYear()}`}
        refDate={refDate}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, month0) => {
          const total = daysInMonth(year, month0)
          const planned = plannedDays[month0].size
          const isCurrent =
            year === now.getFullYear() && month0 === now.getMonth()
          return (
            <Link
              key={month0}
              to={`/month/${monthKey(new Date(year, month0, 1))}`}
              className={`flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md ${
                isCurrent ? 'border-brand-400 ring-1 ring-brand-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  {formatMonthShort(year, month0)}
                </h3>
                {isCurrent ? (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    This month
                  </span>
                ) : null}
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {planned}/{total}{' '}
                <span className="font-normal text-slate-500">days planned</span>
              </div>
              <FillBar value={total ? planned / total : 0} />

              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>{itemCount[month0]} items</span>
                {specialCount[month0] > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-brand-200" />
                    {specialCount[month0]} special
                  </span>
                ) : null}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
