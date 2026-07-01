import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import LoginView from './pages/LoginView'
import YearView from './pages/YearView'
import MonthView from './pages/MonthView'
import WeekView from './pages/WeekView'
import DayView from './pages/DayView'
import GridView from './pages/GridView'
import ComposeView from './pages/ComposeView'
import SettingsView from './pages/SettingsView'
import ClientsView from './pages/ClientsView'
import TeamView from './pages/TeamView'
import { useAuth, useIsTeam } from './lib/auth'
import { isApiConfigured } from './lib/api'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">
        This screen isn&rsquo;t available. Use the menu on the left to get around.
      </p>
    </div>
  )
}

/**
 * The app chrome (sidebar + header) wraps every route EXCEPT the full-screen
 * login pages. Requires a session when a real backend is configured; in
 * backend-less demo mode auth is bypassed (sample data, single viewer).
 */
function ProtectedLayout() {
  const session = useAuth()
  if (isApiConfigured && !session) return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

/** Apar-team-only routes (client sessions get bounced to the review surface). */
function TeamRoute() {
  const isTeam = useIsTeam()
  if (isApiConfigured && !isTeam) return <Navigate to="/grid" replace />
  return <Outlet />
}

export default function App() {
  const currentYear = new Date().getFullYear()
  return (
    <Routes>
      {/* Full-screen login pages, no app chrome. Clients at "/", admins at "/admin". */}
      <Route path="/" element={<LoginView variant="client" />} />
      <Route path="/admin" element={<LoginView variant="admin" />} />

      {/* Everything else lives inside the app shell (and behind auth). */}
      <Route element={<ProtectedLayout />}>
        <Route path="/year" element={<Navigate to={`/year/${currentYear}`} replace />} />
        <Route path="/year/:year" element={<YearView />} />
        <Route path="/month/:month" element={<MonthView />} />
        <Route path="/week/:weekStart" element={<WeekView />} />
        <Route path="/day/:date" element={<DayView />} />
        <Route path="/grid" element={<GridView />} />

        {/* Team-only: authoring + workspace administration. */}
        <Route element={<TeamRoute />}>
          <Route path="/compose" element={<ComposeView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/clients" element={<ClientsView />} />
          <Route path="/team" element={<TeamView />} />
        </Route>

        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Route>
    </Routes>
  )
}
