import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { monthKey, formatMonthYear, toISODate } from '../lib/dates'

function IconCalendar() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}
function IconGrid() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconPlus() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

type Action = { to: string; label: string; sub: string; icon: ReactNode }

export default function HomeView() {
  const now = new Date()
  const currentMonth = monthKey(now) // e.g. "2026-06"
  const monthLabel = formatMonthYear(now.getFullYear(), now.getMonth()) // "June 2026"
  const todayISO = toISODate(now)

  const actions: Action[] = [
    { to: `/month/${currentMonth}`, label: 'This month', sub: monthLabel, icon: <IconCalendar /> },
    { to: '/grid', label: 'Overview feed', sub: 'See everything at a glance', icon: <IconGrid /> },
    {
      to: `/compose?date=${todayISO}&type=post`,
      label: 'Add content',
      sub: 'Post · Reel · Story · Caption',
      icon: <IconPlus />,
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Grainient hero ──────────────────────────────────────────── */}
      <section className="grainient relative overflow-hidden rounded-3xl px-6 py-12 text-white shadow-[0_24px_60px_-24px_rgba(138,31,12,0.65)] sm:px-10 sm:py-16 lg:py-24">
        <div className="flex min-h-[clamp(22rem,52vh,34rem)] flex-col">
          {/* Tiny centred top label, like the reference's "2026" */}
          <p className="mx-auto text-[11px] font-semibold tracking-[0.32em] text-white/75">
            {now.getFullYear()}
          </p>

          {/* Negative space pushes the wordmark into the lower third */}
          <div className="flex-1" />

          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
            Content Calendar
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Chheda&rsquo;s <span className="font-light text-white/55">&times;</span> Apar
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
            One warm home for every post, reel and story. Plan the month,
            finalise the week, ship on time.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to={`/month/${currentMonth}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-brand-700 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition hover:bg-cream active:scale-[.98]"
            >
              Open {monthLabel} <span aria-hidden>&rarr;</span>
            </Link>
            <Link
              to="/grid"
              className="inline-flex items-center gap-2 rounded-xl bg-white/[0.12] px-5 py-3 text-base font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
            >
              View the feed
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quick-action glass cards ────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="glass-add group p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-brand-600 shadow-sm ring-1 ring-brand-100">
              {a.icon}
            </span>
            <span className="mt-4 text-base font-extrabold text-ink">{a.label}</span>
            <span className="mt-0.5 text-sm font-medium text-brand-900/70">{a.sub}</span>
            <span aria-hidden className="mt-3 text-lg text-brand-600/80 transition group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
