// The auth session store — a tiny external store (no React-tree dependency) so
// both the API client (synchronously, at request time) and React components can
// read the current token + active workspace. Persisted to localStorage so a
// refresh keeps you logged in.
//
// This module imports NOTHING from api.ts (it's a leaf) to keep the dependency
// graph acyclic: api.ts → authStore (token), auth.ts → api + authStore + query.
import { useSyncExternalStore } from 'react'
import type { AccountKind, ClientBrief } from '../types/database'

export interface AuthSession {
  token: string
  kind: AccountKind
  name: string
  userId: string
  /** The workspace currently being viewed. For clients this equals their own id. */
  activeClientId: string | null
  /** Workspaces this account can reach (all clients for team; just self for client). */
  clients: ClientBrief[]
}

const KEY = 'cc_auth'
let current: AuthSession | null = load()
const listeners = new Set<() => void>()

function load(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}
function persist() {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}
function emit() {
  listeners.forEach((l) => l())
}

export function getSession(): AuthSession | null {
  return current
}
export function setSession(s: AuthSession | null) {
  current = s
  persist()
  emit()
}
export function patchSession(p: Partial<AuthSession>) {
  if (!current) return
  current = { ...current, ...p }
  persist()
  emit()
}
export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// Synchronous accessors used by the API client to stamp request headers.
export function getToken(): string | null {
  return current?.token ?? null
}
export function getActiveClientId(): string | null {
  return current?.activeClientId ?? null
}

/** React hook: re-renders when the session changes. */
export function useAuth(): AuthSession | null {
  return useSyncExternalStore(subscribe, getSession, getSession)
}
