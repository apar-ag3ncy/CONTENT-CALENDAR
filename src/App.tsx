import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import LandingView from './pages/LandingView'
import YearView from './pages/YearView'
import MonthView from './pages/MonthView'
import WeekView from './pages/WeekView'
import DayView from './pages/DayView'
import GridView from './pages/GridView'
import ComposeView from './pages/ComposeView'
import SettingsView from './pages/SettingsView'

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

/** The app chrome (sidebar + header) wraps every route EXCEPT the full-screen landing. */
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
      {/* Full-screen landing page — no app chrome. */}
      <Route path="/" element={<LandingView />} />

      {/* Everything else lives inside the app shell. */}
      <Route element={<AppLayout />}>
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
