import type { PeriodLock } from '../types/database'
import { formatLongDate, parseISODate } from '../lib/dates'

/** Small lock pill shown in the corner of a locked day. */
export function LockPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
      title="Locked — follow this plan"
    >
      <span aria-hidden>🔒</span>
      Locked
    </span>
  )
}

/**
 * Banner shown above a view when some of the visible days are locked.
 * The full finalize/lock experience (who & when) is wired up in Phase 5.
 */
export function LockBanner({ locks }: { locks: PeriodLock[] }) {
  if (locks.length === 0) return null
  const note = locks.find((l) => l.note)?.note
  const since = locks
    .map((l) => l.finalized_at)
    .filter(Boolean)
    .sort()[0]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <span className="text-lg" aria-hidden>
        🔒
      </span>
      <div className="text-sm">
        <div className="font-semibold text-brand-800">
          Locked — follow this plan
        </div>
        <div className="text-brand-700">
          These days are set — please follow the plan as it is. You can still mark
          items done, but you can&rsquo;t change the planned content.
          {note ? ` Note: ${note}` : ''}
          {since
            ? ` (locked since ${formatLongDate(parseISODate(since.slice(0, 10)))})`
            : ''}
        </div>
      </div>
    </div>
  )
}
