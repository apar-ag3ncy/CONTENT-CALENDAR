import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { monthKey } from '../lib/dates'
import { isFirebaseConfigured } from '../lib/firebase'
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

/** The sidebar index: just the 12 months, to hop from one month to another. */
function MonthList({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { pathname } = useLocation()
  const now = new Date()
  const match = pathname.match(/^\/month\/(\d{4})-(\d{2})/)
  const routeYear = match ? Number(match[1]) : now.getFullYear()
  const activeKey = match ? `${match[1]}-${match[2]}` : null
  const currentKey = monthKey(now)
  const [year, setYear] = useState(routeYear)
  // Follow the route's year when you navigate.
  useEffect(() => setYear(routeYear), [routeYear])

  if (collapsed) {
    return (
      <nav aria-label="Months" className="flex flex-col items-center gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const key = `${routeYear}-${String(m + 1).padStart(2, '0')}`
          const label = new Date(routeYear, m, 1).toLocaleDateString('en-US', { month: 'short' })
          const active = key === activeKey
          const current = key === currentKey
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
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} className="grid h-7 w-7 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100">
          ‹
        </button>
        <span className="text-sm font-bold text-gray-900">{year}</span>
        <button type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)} className="grid h-7 w-7 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100">
          ›
        </button>
      </div>
      <nav aria-label="Months" className="flex flex-col gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`
          const label = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'long' })
          const active = key === activeKey
          const current = key === currentKey
          return (
            <Link
              key={m}
              to={`/month/${key}`}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : current ? 'text-brand-700 hover:bg-brand-50' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {current && !active ? <span className="text-[10px] font-bold text-brand-500">Now</span> : null}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      to={`/month/${monthKey(new Date())}`}
      className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar — collapses to an icon rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-gray-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className={`flex h-16 flex-none items-center border-b border-gray-200 ${collapsed ? 'justify-center px-0' : 'px-6'}`}>
          <Brand collapsed={collapsed} />
        </div>
        <div className={`flex-1 overflow-y-auto py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
          <MonthList collapsed={collapsed} />
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
              <MonthList onNavigate={() => setDrawerOpen(false)} />
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
        {!isFirebaseConfigured ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            ⚠️ Firebase isn&rsquo;t connected yet — showing an empty calendar. Add
            your keys to{' '}
            <code className="font-mono font-semibold">.env.local</code> (see the
            README) to load and save content.
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
