import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { type ReactNode } from 'react'
import { AppShell } from './components/AppShell'
import LandingView from './pages/LandingView'
import LoginView from './pages/LoginView'
import YearView from './pages/YearView'
import MonthView from './pages/MonthView'
import WeekView from './pages/WeekView'
import DayView from './pages/DayView'
import GridView from './pages/GridView'
import ComposeView from './pages/ComposeView'
import SettingsView from './pages/SettingsView'
import { useAuth } from './lib/auth'
import { isApiConfigured } from './lib/api'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-slate-900 dark:text-parchment">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-parchment/60">
        This screen isn&rsquo;t available. Use the menu on the left to get around.
      </p>
    </div>
  )
}

/** Require a signed-in user when a backend is configured. Demo mode is open. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (!isApiConfigured) return <>{children}</>
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-950 text-sm text-parchment/60">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

/** The app chrome (sidebar + header) wraps every route EXCEPT landing & login. */
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default function App() {
  const currentYear = new Date().getFullYear()
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingView />} />
      <Route path="/login" element={<LoginView />} />

      {/* Everything else needs a sign-in (when a backend is connected). */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/year" element={<Navigate to={`/year/${currentYear}`} replace />} />
        <Route path="/year/:year" element={<YearView />} />
        <Route path="/month/:month" element={<MonthView />} />
        <Route path="/week/:weekStart" element={<WeekView />} />
        <Route path="/day/:date" element={<DayView />} />
        <Route path="/grid" element={<GridView />} />
        <Route path="/compose" element={<ComposeView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Route>
    </Routes>
  )
}
