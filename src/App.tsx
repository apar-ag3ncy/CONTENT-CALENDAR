import { Navigate, Route, Routes } from 'react-router-dom'
import { monthKey } from './lib/dates'
import { AppShell } from './components/AppShell'
import YearView from './pages/YearView'
import MonthView from './pages/MonthView'
import WeekView from './pages/WeekView'
import DayView from './pages/DayView'
import GridView from './pages/GridView'
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

export default function App() {
  const now = new Date()
  const currentMonth = monthKey(now)
  const currentYear = now.getFullYear()
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to={`/month/${currentMonth}`} replace />} />
        <Route path="/year" element={<Navigate to={`/year/${currentYear}`} replace />} />
        <Route path="/year/:year" element={<YearView />} />
        <Route path="/month/:month" element={<MonthView />} />
        <Route path="/week/:weekStart" element={<WeekView />} />
        <Route path="/day/:date" element={<DayView />} />
        <Route path="/grid" element={<GridView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Routes>
    </AppShell>
  )
}
