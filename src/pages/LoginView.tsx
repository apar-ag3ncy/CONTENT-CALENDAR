import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isApiConfigured } from '../lib/api'
import { humanError } from '../lib/errors'

export default function LoginView() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const dest = location.state?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // No backend (demo) → no login. Already signed in → go to the app.
  if (!isApiConfigured) return <Navigate to="/" replace />
  if (user) return <Navigate to={dest} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate(dest, { replace: true })
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-parchment placeholder:text-parchment/40 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-night-950 px-4 text-parchment">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: 'radial-gradient(52rem 42rem at 50% 122%, rgba(232,80,2,0.22), transparent 60%)' }}
      />
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src="/apar-logo-white.svg" alt="Apar" className="h-9 w-auto" />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.3em] text-parchment/45">Content Calendar</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-night-850 p-6 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)] sm:p-7"
        >
          <h1 className="font-serif text-2xl font-bold text-parchment">Sign in</h1>
          <p className="mt-1 text-sm text-parchment/55">Welcome back to the team calendar.</p>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-parchment/80">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@apar.agency"
              className={inputCls}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-parchment/80">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </label>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy || loading}
            className="mt-5 w-full rounded-xl bg-gradient-to-br from-flame-500 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(214,46,20,0.8)] transition hover:brightness-110 active:scale-[.99] disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-xs text-parchment/40">
            No account? Ask an admin to add you in Settings → Users.
          </p>
        </form>
      </div>
    </div>
  )
}
