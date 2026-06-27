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
  hero = false,
}: {
  active: View
  refDate: Date
  hero?: boolean
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
    <div
      className={`inline-flex rounded-xl p-1 ${hero ? 'bg-white/15' : 'bg-slate-100'}`}
    >
      {items.map((it) => (
        <Link
          key={it.key}
          to={hrefs[it.key]}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            active === it.key
              ? 'bg-white text-brand-700 shadow-sm'
              : hero
                ? 'text-white/80 hover:text-white'
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
  /** Warm grainient hero treatment (used on the month view). */
  hero?: boolean
}

export function CalendarToolbar({
  view,
  title,
  subtitle,
  prevTo,
  nextTo,
  todayTo,
  refDate,
  hero = false,
}: ToolbarProps) {
  const prevLabel =
    view === 'year'
      ? 'Previous year'
      : view === 'month'
        ? 'Previous month'
        : 'Previous week'
  const nextLabel =
    view === 'year' ? 'Next year' : view === 'month' ? 'Next month' : 'Next week'

  const arrowCls = hero
    ? 'border-white/30 text-white hover:bg-white/15'
    : 'border-slate-200 text-slate-600 hover:bg-slate-50'

  return (
    <div
      className={
        hero
          ? 'grainient flex flex-col gap-3 rounded-3xl px-5 py-5 text-white shadow-[0_18px_40px_-18px_rgba(138,31,12,0.55)] sm:flex-row sm:items-center sm:justify-between sm:px-7'
          : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
      }
    >
      <div className="flex items-center gap-2">
        <Link
          to={prevTo}
          aria-label={prevLabel}
          className={`grid h-10 w-10 place-items-center rounded-xl border transition active:scale-95 ${arrowCls}`}
        >
          <Chevron dir="left" />
        </Link>
        <Link
          to={nextTo}
          aria-label={nextLabel}
          className={`grid h-10 w-10 place-items-center rounded-xl border transition active:scale-95 ${arrowCls}`}
        >
          <Chevron dir="right" />
        </Link>
        <div className="ml-1">
          <h1
            className={`text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl ${
              hero ? 'text-white' : 'text-grainient'
            }`}
          >
            {title}
          </h1>
          {subtitle ? (
            <div
              className={`mt-0.5 text-xs font-medium ${hero ? 'text-white/80' : 'text-slate-500'}`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={todayTo}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            hero
              ? 'border-white/30 text-white hover:bg-white/15'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Today
        </Link>
        <ViewSwitcher active={view} refDate={refDate} hero={hero} />
      </div>
    </div>
  )
}
