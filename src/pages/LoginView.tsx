import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, RoleMismatchError, useAuth } from '../lib/auth'
import { isApiConfigured } from '../lib/api'
import { humanError } from '../lib/errors'

/**
 * Sign-in screen. Two variants:
 *  • 'client' — lives at "/", accepts only client logins.
 *  • 'admin'  — lives at "/admin", accepts only Apar team logins.
 * A credential of the wrong kind is rejected and pointed at the other page.
 */
export default function LoginView({ variant }: { variant: 'client' | 'admin' }) {
  const navigate = useNavigate()
  const session = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = variant === 'admin'
  const expectedKind = isAdmin ? 'team' : 'client'

  // Already signed in (or running in backend-less demo mode) → into the app.
  useEffect(() => {
    if (session || !isApiConfigured) navigate('/grid', { replace: true })
  }, [session, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (username.trim() === '' || password === '') return
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password, expectedKind)
      navigate('/grid', { replace: true })
    } catch (err) {
      if (err instanceof RoleMismatchError) {
        setError(
          isAdmin
            ? 'Those are client credentials. Clients sign in on the home page.'
            : 'That’s an Apar team login. Please use the admin sign-in.',
        )
      } else {
        setError(humanError(err))
      }
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#171210] px-4 text-white">
      {/* warm Apar glow */}
      <span aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-flame-500/20 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/apar-logo-white.svg" alt="Apar" className="h-9 w-auto" />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.28em] text-white/50">
            Content Calendar
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl"
        >
          <div>
            {isAdmin ? (
              <span className="mb-2 inline-flex rounded-full bg-brand-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300">
                Apar Team
              </span>
            ) : null}
            <h1 className="text-xl font-extrabold tracking-tight">
              {isAdmin ? 'Admin sign-in' : 'Client sign-in'}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {isAdmin
                ? 'Sign in to manage clients, content and team.'
                : 'Sign in to review and approve your content calendar.'}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-white/70">Username</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="your username"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-white/70">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/15 px-3.5 py-2.5 text-sm font-medium text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || username.trim() === '' || password === ''}
            className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(214,46,20,0.8)] transition hover:bg-brand-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Cross-link to the other entry point. */}
          <p className="pt-1 text-center text-xs text-white/40">
            {isAdmin ? (
              <Link to="/" className="font-semibold text-white/60 transition hover:text-white">
                ← Client sign-in
              </Link>
            ) : (
              <Link to="/admin" className="font-semibold text-white/60 transition hover:text-white">
                Apar team member? Admin sign-in →
              </Link>
            )}
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          Apar Agency · access is managed by your Apar team
        </p>
      </div>
    </div>
  )
}
