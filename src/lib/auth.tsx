// Auth context: current user, login/logout, and role-derived permissions.
// Only active when a backend is configured (VITE_API_URL); in demo mode there's
// no login and editing is off.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, isApiConfigured, type AuthUser } from './api'
import { getToken, setToken, onTokenChange } from './authStore'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  isAdmin: boolean
  /** Full edit (add/edit/remove/upload/lock/manage) — admins only. */
  canEdit: boolean
  /** Change an item's status — any signed-in user (admins + managers). */
  canSetStatus: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isApiConfigured)

  async function refresh() {
    if (!isApiConfigured || !getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      setUser(await api.me())
    } catch {
      setUser(null)
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // If the token gets cleared elsewhere (e.g. a 401), drop the user too.
    return onTokenChange(() => {
      if (!getToken()) setUser(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setToken(res.token)
    setUser(res.user)
  }
  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value: AuthState = {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    canEdit: isApiConfigured ? user?.role === 'admin' : false,
    canSetStatus: isApiConfigured ? Boolean(user) : false,
    login,
    logout,
    refresh,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
