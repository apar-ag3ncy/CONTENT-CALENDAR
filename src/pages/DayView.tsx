import { Link, Navigate, useParams } from 'react-router-dom'
import { DayContent } from '../components/DayContent'
import { LockBanner } from '../components/LockIndicators'
import { usePeriodLocks } from '../hooks/useCalendarData'
import {
  isValidISODate,
  mondayOf,
  monthKey,
  parseISODate,
  toISODate,
} from '../lib/dates'

export default function DayView() {
  const { date } = useParams()
  const now = new Date()

  const valid = isValidISODate(date)
  const iso = valid ? (date as string) : toISODate(now)

  // Always call hooks in the same order; redirect for an invalid param after.
  const locksQ = usePeriodLocks(iso, iso)
  const locks = locksQ.data ?? []

  if (!valid) {
    return <Navigate to={`/month/${monthKey(now)}`} replace />
  }

  const d = parseISODate(iso)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to={`/month/${monthKey(d)}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          ‹ Month
        </Link>
        <Link
          to={`/week/${toISODate(mondayOf(d))}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Week
        </Link>
      </div>

      <LockBanner locks={locks} />

      <DayContent dateISO={iso} />
    </div>
  )
}
