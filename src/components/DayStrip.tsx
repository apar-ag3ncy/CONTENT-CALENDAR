import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { daysInMonth, isToday, toISODate, weekdayMonFirst } from '../lib/dates'

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A horizontal strip of the month's days to pick which day to open. */
export function DayStrip({
  monthKeyStr,
  year,
  month0,
  selected,
}: {
  monthKeyStr: string
  year: number
  month0: number
  selected: string
}) {
  const now = new Date()
  const count = daysInMonth(year, month0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Keep the chosen day centred in the strip (scrolls only the strip, never
  // the page) so the selection is always visible even late in the month.
  useEffect(() => {
    const el = activeRef.current
    const wrap = wrapRef.current
    if (!el || !wrap) return
    const target = el.offsetLeft - wrap.clientWidth / 2 + el.clientWidth / 2
    wrap.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [selected, year, month0])

  return (
    <div ref={wrapRef} className="card overflow-x-auto p-2">
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(year, month0, i + 1)
          const iso = toISODate(date)
          const active = selected === iso
          const today = isToday(date, now)
          const weekend = weekdayMonFirst(date) >= 5
          return (
            <Link
              key={iso}
              ref={active ? activeRef : undefined}
              to={`/month/${monthKeyStr}?d=${iso}`}
              aria-current={active ? 'date' : undefined}
              className={`relative flex w-12 flex-none flex-col items-center rounded-xl px-1 py-2 text-center transition ${
                active
                  ? 'bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(214,46,20,0.6)]'
                  : today
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                    : weekend
                      ? 'text-slate-400 hover:bg-slate-100'
                      : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase ${
                  active ? 'text-white/80' : 'text-slate-400'
                }`}
              >
                {WD[weekdayMonFirst(date)]}
              </span>
              <span className="text-sm font-bold">{i + 1}</span>
              {today && !active ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" aria-hidden />
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
