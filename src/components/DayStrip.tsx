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
  return (
    <div className="card overflow-x-auto p-2">
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(year, month0, i + 1)
          const iso = toISODate(date)
          const active = selected === iso
          const today = isToday(date, now)
          return (
            <Link
              key={iso}
              to={`/month/${monthKeyStr}?d=${iso}`}
              aria-current={active ? 'date' : undefined}
              className={`flex w-12 flex-none flex-col items-center rounded-xl px-1 py-2 text-center transition ${
                active
                  ? 'bg-brand-600 text-white'
                  : today
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase ${
                  active ? 'text-white/80' : 'text-gray-400'
                }`}
              >
                {WD[weekdayMonFirst(date)]}
              </span>
              <span className="text-sm font-bold">{i + 1}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
