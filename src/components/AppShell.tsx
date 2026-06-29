import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/motion'
import {
  WEEKDAY_SHORT,
  daysInMonth,
  isToday,
  monthKey,
  parseISODate,
  toISODate,
  weekdayMonFirst,
} from '../lib/dates'
import { selectedDateFor } from './MonthIndex'
import { isApiConfigured } from '../lib/api'
import { useDialog } from '../hooks/useDialog'

// ---- header icons ----------------------------------------------------------
function IconMenu() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}
function IconInstagram({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Sidebar entry point to the Instagram-style Grid Review page. */
function GridReviewLink({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()
  const active = pathname === '/grid'

  if (collapsed) {
    return (
      <Link
        to="/grid"
        onClick={onNavigate}
        title="Grid Review"
        aria-label="Grid Review"
        aria-current={active ? 'page' : undefined}
        className={`mx-auto grid h-11 w-12 place-items-center rounded-xl transition ${
          active ? 'bg-forest-600 text-white' : 'text-forest-700 hover:bg-forest-50'
        }`}
      >
        <IconInstagram />
      </Link>
    )
  }

  return (
    <Link
      to="/grid"
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
        active
          ? 'bg-forest-600 text-white shadow-[0_8px_20px_-10px_rgba(33,64,52,0.8)]'
          : 'bg-forest-50 text-forest-800 hover:bg-forest-100'
      }`}
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-sm">
        <IconInstagram className="h-[18px] w-[18px]" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold">Grid Review</span>
        <span className={`text-[11px] ${active ? 'text-white/75' : 'text-forest-500'}`}>
          Instagram feed preview
        </span>
      </span>
    </Link>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The systematic sidebar index: a collapsible Month picker (the active month
 * stays on top; the Jan–Dec list only pops open when you go to switch), then
 * the month's Weeks as options (1–7, 8–14, …), then the days of the active week
 * as calm gradient pills. No constant re-popping.
 */
function CalendarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { pathname, search } = useLocation()
  const now = new Date()
  const match = pathname.match(/^\/month\/(\d{4})-(\d{2})/)
  const onMonthRoute = Boolean(match)
  const year = match ? Number(match[1]) : now.getFullYear()
  const month0 = match ? Number(match[2]) - 1 : now.getMonth()
  const mk = `${year}-${pad2(month0 + 1)}`
  const currentKey = monthKey(now)
  const monthLong = new Date(year, month0, 1).toLocaleDateString('en-US', { month: 'long' })
  const monthShort = new Date(year, month0, 1).toLocaleDateString('en-US', { month: 'short' })

  const selectedISO =
    selectedDateFor(mk, search, now) ?? toISODate(new Date(year, month0, 1))
  const selectedDay = parseISODate(selectedISO).getDate()

  // The Jan–Dec list is hidden until you open the picker to change months.
  const [menuOpen, setMenuOpen] = useState(false)
  const [weeksOpen, setWeeksOpen] = useState(false)
  const [pickYear, setPickYear] = useState(year)
  useEffect(() => setPickYear(year), [year])

  // Weeks = systematic 7-day chunks of the month (1–7, 8–14, …).
  const dim = daysInMonth(year, month0)
  const weeks: { n: number; start: number; end: number }[] = []
  for (let s = 1; s <= dim; s += 7) {
    weeks.push({ n: weeks.length + 1, start: s, end: Math.min(s + 6, dim) })
  }
  const activeWeekIdx = Math.min(Math.floor((selectedDay - 1) / 7), weeks.length - 1)
  const activeWeek = weeks[activeWeekIdx]
  const weekDays = Array.from(
    { length: activeWeek.end - activeWeek.start + 1 },
    (_, i) => new Date(year, month0, activeWeek.start + i),
  )

  if (collapsed) {
    return (
      <nav aria-label="Months" className="flex flex-col items-center gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const key = `${year}-${pad2(m + 1)}`
          const active = onMonthRoute && m === month0
          const current = key === currentKey
          const label = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' })
          return (
            <Link
              key={m}
              to={`/month/${key}`}
              onClick={onNavigate}
              title={label}
              className={`grid h-9 w-12 place-items-center rounded-lg text-xs font-semibold transition ${
                active ? 'bg-brand-600 text-white' : current ? 'text-brand-700 hover:bg-brand-50' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Month picker — active month on top; list pops only to switch ── */}
      <div>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          className="flex w-full items-center justify-between rounded-xl bg-brand-600 px-3.5 py-2.5 text-left text-white shadow-[0_8px_20px_-10px_rgba(214,46,20,0.7)] transition hover:bg-brand-700"
        >
          <span className="text-sm font-bold">
            {monthLong} {year}
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen ? (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <button type="button" aria-label="Previous year" onClick={() => setPickYear((y) => y - 1)} className="grid h-7 w-7 place-items-center rounded-lg text-gray-500 hover:bg-gray-100">
                ‹
              </button>
              <span className="text-sm font-bold text-gray-900">{pickYear}</span>
              <button type="button" aria-label="Next year" onClick={() => setPickYear((y) => y + 1)} className="grid h-7 w-7 place-items-center rounded-lg text-gray-500 hover:bg-gray-100">
                ›
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, m) => {
                const key = `${pickYear}-${pad2(m + 1)}`
                const active = onMonthRoute && pickYear === year && m === month0
                const current = key === currentKey
                const label = new Date(pickYear, m, 1).toLocaleDateString('en-US', { month: 'short' })
                return (
                  <Link
                    key={m}
                    to={`/month/${key}`}
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigate?.()
                    }}
                    className={`rounded-lg py-1.5 text-center text-xs font-semibold transition ${
                      active ? 'bg-brand-600 text-white' : current ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Weeks picker — active week on top; list pops only to switch ── */}
      <div>
        <div className="mb-2 flex items-center gap-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Weeks</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <button
          type="button"
          onClick={() => setWeeksOpen((o) => !o)}
          aria-expanded={weeksOpen}
          className="flex w-full items-center justify-between rounded-xl bg-brand-600 px-3.5 py-2.5 text-left text-white shadow-[0_8px_20px_-10px_rgba(214,46,20,0.7)] transition hover:bg-brand-700"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-bold">Week {activeWeek.n}</span>
            <span className="text-xs font-medium text-white/70">
              {monthShort} {activeWeek.start}–{activeWeek.end}
            </span>
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${weeksOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {weeksOpen ? (
          <nav aria-label="Weeks" className="mt-2 flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            {weeks.map((w, i) => {
              const active = i === activeWeekIdx
              const firstISO = toISODate(new Date(year, month0, w.start))
              return (
                <Link
                  key={w.n}
                  to={`/month/${mk}?d=${firstISO}`}
                  onClick={() => {
                    setWeeksOpen(false)
                    onNavigate?.()
                  }}
                  aria-current={active ? 'true' : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    active ? 'bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Week {w.n}</span>
                  <span className={`text-xs ${active ? 'text-brand-500' : 'text-slate-400'}`}>
                    {monthShort} {w.start}–{w.end}
                  </span>
                </Link>
              )
            })}
          </nav>
        ) : null}
      </div>

      {/* ── Days of the active week (calm gradient pills) ── */}
      <div>
        <div className="mb-2 flex items-center gap-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {monthShort} {activeWeek.start}–{activeWeek.end}
          </span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>
        <nav aria-label="Days" className="relative flex flex-col px-0.5">
          {weekDays.map((date, i) => {
            const iso = toISODate(date)
            const active = selectedISO === iso
            const today = isToday(date, now)
            const s = dayPillStyle(weekDays.length > 1 ? i / (weekDays.length - 1) : 0)
            return (
              <Link
                key={iso}
                to={`/month/${mk}?d=${iso}`}
                onClick={onNavigate}
                aria-current={active ? 'date' : undefined}
                style={{
                  backgroundColor: s.backgroundColor,
                  color: s.color,
                  marginTop: i === 0 ? 0 : -8,
                  zIndex: active ? 60 : i + 1,
                  boxShadow: active
                    ? `inset 0 0 0 2px ${s.color}, 0 10px 22px -6px rgba(92, 20, 16, 0.55)`
                    : '0 4px 10px -5px rgba(99, 29, 16, 0.5)',
                }}
                className={`relative flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-transform ${
                  active ? 'scale-[1.04] font-extrabold' : 'hover:translate-x-0.5'
                }`}
              >
                <span className="w-9 flex-none text-[10px] font-bold uppercase tracking-wide opacity-70">
                  {WEEKDAY_SHORT[weekdayMonFirst(date)]}
                </span>
                <span className="tabular-nums text-sm font-bold">{date.getDate()}</span>
                {today ? (
                  <span aria-hidden title="Today" className="ml-auto h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                ) : null}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

/** Dark→light APAR-red ramp for the stacked day pills (top dark, bottom light). */
function dayPillStyle(t: number): { backgroundColor: string; color: string } {
  const top = [0x6b, 0x1a, 0x10] // deep brand red
  const bot = [0xfb, 0xdd, 0xd4] // brand-100, almost blush
  const r = Math.round(top[0] + (bot[0] - top[0]) * t)
  const g = Math.round(top[1] + (bot[1] - top[1]) * t)
  const b = Math.round(top[2] + (bot[2] - top[2]) * t)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: lum > 150 ? '#5c1410' : '#ffffff',
  }
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      to="/"
      className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-flame-500 text-lg font-bold text-white shadow-sm">
        C
      </span>
      {!collapsed ? (
        <div className="leading-tight">
          <div className="text-sm font-bold text-gray-900">Chheda&rsquo;s × Apar</div>
          <div className="text-[11px] text-gray-400">Content Calendar</div>
        </div>
      ) : null}
    </Link>
  )
}

function TopHeader({
  onMobileMenu,
  onDesktopToggle,
}: {
  onMobileMenu: () => void
  onDesktopToggle: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onMobileMenu}
          aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100 lg:hidden"
        >
          <IconMenu />
        </button>
        <button
          type="button"
          onClick={onDesktopToggle}
          aria-label="Toggle sidebar"
          className="hidden h-10 w-10 place-items-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100 lg:grid"
        >
          <IconMenu />
        </button>

        <div className="relative hidden max-w-md flex-1 sm:block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch />
          </span>
          <input
            type="search"
            aria-label="Search"
            placeholder="Search or type command…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-16 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:bg-white"
          />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-400 md:block">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
          >
            <IconBell />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
          </button>
          <Link
            to="/settings#info"
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              A
            </span>
            <span className="hidden text-sm font-semibold text-gray-700 sm:block">Apar Team</span>
            <span className="hidden text-xs text-gray-400 sm:block" aria-hidden>▾</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const drawerRef = useDialog(drawerOpen, () => setDrawerOpen(false))

  const { pathname } = useLocation()
  useEffect(() => {
    // New page: scroll to top (smooth unless reduced-motion), then re-measure triggers.
    if (prefersReducedMotion()) {
      window.scrollTo(0, 0)
    } else {
      gsap.to(window, { duration: 0.5, scrollTo: { y: 0 }, ease: 'power2.out' })
    }
    // Defer refresh until after the new route paints so start/end positions are correct.
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — collapses to an icon rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-gray-200/80 bg-white/85 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className={`flex h-16 flex-none items-center border-b border-gray-200 ${collapsed ? 'justify-center px-0' : 'px-6'}`}>
          <Brand collapsed={collapsed} />
        </div>
        <div className={`flex-1 overflow-y-auto py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
          <div className={collapsed ? 'mb-4' : 'mb-5'}>
            <GridReviewLink collapsed={collapsed} />
          </div>
          <CalendarNav collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-white shadow-xl outline-none"
          >
            <div className="flex h-16 flex-none items-center justify-between border-b border-gray-200 px-6">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="mb-5">
                <GridReviewLink onNavigate={() => setDrawerOpen(false)} />
              </div>
              <CalendarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <TopHeader
          onMobileMenu={() => setDrawerOpen(true)}
          onDesktopToggle={() => setCollapsed((c) => !c)}
        />
        {!isApiConfigured ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            ⚠️ Showing sample data — the backend isn&rsquo;t connected. Set{' '}
            <code className="font-mono font-semibold">VITE_API_URL</code> to your
            MongoDB API (see <code className="font-mono font-semibold">server/</code>)
            to plan &amp; save real, shared content.
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
