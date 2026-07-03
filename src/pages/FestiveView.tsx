import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useContentItems } from '../hooks/useCalendarData'
import { FestiveList } from '../components/FestiveList'
import { endOfMonth, formatMonthYear, monthKey, parseMonthKey, toISODate } from '../lib/dates'

// All festive-tagged content for a whole month, grouped by type (Posts / Reels /
// Stories / Captions). Reached from the sidebar under the month picker.
export default function FestiveView() {
  const { month } = useParams()
  const navigate = useNavigate()
  const now = new Date()
  const parsed = parseMonthKey(month)

  const { year, month0 } = parsed ?? { year: now.getFullYear(), month0: now.getMonth() }
  const firstOfMonth = new Date(year, month0, 1)
  const startISO = toISODate(firstOfMonth)
  const endISO = toISODate(endOfMonth(firstOfMonth))
  const mk = monthKey(firstOfMonth)

  const itemsQ = useContentItems(startISO, endISO)

  if (!parsed) return <Navigate to={`/festive/${monthKey(now)}`} replace />

  const festive = (itemsQ.data ?? []).filter((i) => i.is_festive)

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-flame-200 bg-gradient-to-br from-flame-50 to-brand-50 px-6 py-6 dark:border-flame-500/20 dark:from-flame-500/10 dark:to-brand-500/5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-flame-100 text-2xl dark:bg-flame-500/15">
              🎉
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-flame-600 dark:text-flame-300">
                Festive content
              </p>
              <h1 className="font-serif text-2xl font-bold text-slate-900 sm:text-3xl">
                {formatMonthYear(year, month0)}
              </h1>
            </div>
          </div>
          <Link
            to={`/month/${mk}`}
            className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-white/70 dark:border-white/10"
          >
            ← Back to month
          </Link>
        </div>
      </header>

      <section className="card">
        {itemsQ.isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : festive.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">No festive content this month.</p>
            <p className="mt-1 text-xs text-slate-400">
              Tick “Festive post” when creating a post, reel or story to see it here.
            </p>
          </div>
        ) : (
          <FestiveList items={festive} showDate onOpen={(item) => navigate(`/day/${item.date}`)} />
        )}
      </section>
    </div>
  )
}
