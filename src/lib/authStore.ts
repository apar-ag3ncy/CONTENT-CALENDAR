// Tiny token store shared by the API client and the auth provider (kept
// separate so api.ts has no React/auth import cycle). Persists to localStorage.
let token: string | null = (() => {
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
})()

const listeners = new Set<() => void>()

export function getToken() {
  return token
}

export function setToken(t: string | null) {
  token = t
  try {
    if (t) localStorage.setItem('token', t)
    else localStorage.removeItem('token')
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l())
}

export function onTokenChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
