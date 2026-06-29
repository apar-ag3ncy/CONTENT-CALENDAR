import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarToolbar } from '../components/CalendarToolbar'
import { FinalizeBar } from '../components/FinalizeBar'
import { DayContent } from '../components/DayContent'
import { selectedDateFor } from '../components/MonthIndex'
import { useCalendarRange } from '../hooks/useCalendarData'
import { isApiConfigured } from '../lib/api'
import {
  addMonths,
  endOfMonth,
  formatMonthYear,
  isSameMonth,
  monthKey,
  parseMonthKey,
  toISODate,
} from '../lib/dates'

// The month's list of dates now lives in the left sidebar (MonthIndex); this
// page just shows the selected day's content (driven by the ?d= URL param) in
// the full-width centre, so uploaded posts/reels have room to look good.
export default function MonthView() {
  const { month } = useParams()
  const [searchParams] = useSearchParams()
  const now = new Date()
  const parsed = parseMonthKey(month)

  const { year, month0 } = parsed ?? {
    year: now.getFullYear(),
    month0: now.getMonth(),
  }
  const firstOfMonth = new Date(year, month0, 1)
  const monthStartISO = toISODate(firstOfMonth)
  const monthEndISO = toISODate(endOfMonth(firstOfMonth))

  const { locks, isFetching } = useCalendarRange(monthStartISO, monthEndISO)
  const refDate = isSameMonth(now, year, month0) ? now : firstOfMonth

  if (!parsed) {
    return <Navigate to={`/month/${monthKey(now)}`} replace />
  }

  const selected =
    selectedDateFor(month as string, searchParams.toString(), now) ??
    monthStartISO

  return (
    <div className="space-y-4">
      <CalendarToolbar
        view="month"
        hero
        title={formatMonthYear(year, month0)}
        subtitle={isFetching ? 'Updating…' : undefined}
        prevTo={`/month/${monthKey(addMonths(firstOfMonth, -1))}`}
        nextTo={`/month/${monthKey(addMonths(firstOfMonth, 1))}`}
        todayTo={`/month/${monthKey(now)}`}
        refDate={refDate}
      />

      <FinalizeBar
        scope="month"
        label="month"
        startISO={monthStartISO}
        endISO={monthEndISO}
        locks={locks}
        canEdit={isApiConfigured}
      />

      <DayContent dateISO={selected} />
    </div>
  )
}
