import { Link } from 'react-router-dom'
import { monthKey, mondayOf, toISODate } from '../lib/dates'

type View = 'year' | 'month' | 'week'

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

/** Year / Month / Week switch, computed from the current reference date. */
export function ViewSwitcher({
  active,
  refDate,
}: {
  active: View
  refDate: Date
}) {
  const hrefs: Record<View, string> = {
    year: `/year/${refDate.getFullYear()}`,
    month: `/month/${monthKey(refDate)}`,
    week: `/week/${toISODate(mondayOf(refDate))}`,
  }
  const items: { key: View; label: string }[] = [
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month' },
    { key: 'week', label: 'Week' },
  ]
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {items.map((it) => (
        <Link
          key={it.key}
          to={hrefs[it.key]}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            active === it.key
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  )
}

interface ToolbarProps {
  view: View
  title: string
  subtitle?: string
  prevTo: string
  nextTo: string
  todayTo: string
  refDate: Date
}

export function CalendarToolbar({
  view,
  title,
  subtitle,
  prevTo,
  nextTo,
  todayTo,
  refDate,
}: ToolbarProps) {
  const prevLabel =
    view === 'year'
      ? 'Previous year'
      : view === 'month'
        ? 'Previous month'
        : 'Previous week'
  const nextLabel =
    view === 'year' ? 'Next year' : view === 'month' ? 'Next month' : 'Next week'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Link
          to={prevTo}
          aria-label={prevLabel}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
        >
          <Chevron dir="left" />
        </Link>
        <Link
          to={nextTo}
          aria-label={nextLabel}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
        >
          <Chevron dir="right" />
        </Link>
        <div className="ml-1">
          <h1 className="text-xl font-bold leading-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <div className="text-xs text-slate-500">{subtitle}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={todayTo}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Today
        </Link>
        <ViewSwitcher active={view} refDate={refDate} />
      </div>
    </div>
  )
}
