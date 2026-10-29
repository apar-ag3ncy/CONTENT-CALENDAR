// Auth actions: login / logout / switch workspace, plus role helpers. These sit
// above authStore (the raw session) and api (the network). Switching workspace
// or logging in/out clears the React Query cache so one client's data never
// bleeds into another's view.
import { api, API_BASE, isApiConfigured } from './api'
import { queryClient } from './queryClient'
import {
  getSession,
  patchSession,
  setSession,
  useAuth,
  type AuthSession,
} from './authStore'
import type { AccountKind } from '../types/database'

export { useAuth }
export type { AuthSession }

/** Thrown when credentials are valid but for the wrong login page (client vs admin). */
export class RoleMismatchError extends Error {
  constructor(public actualKind: AccountKind) {
    super('role-mismatch')
    this.name = 'RoleMismatchError'
  }
}

/**
 * Log in, then fetch /me to learn which workspaces are reachable. When
 * `expectedKind` is given, a credential of the wrong kind is rejected BEFORE any
 * session is committed (so e.g. an Apar admin can't sign in via the client page).
 */
export async function login(
  username: string,
  password: string,
  expectedKind?: AccountKind,
): Promise<AccountKind> {
  const res = await api.login(username, password)

  const revoke = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${res.token}` },
      })
    } catch {
      /* best effort */
    }
  }

  if (expectedKind && res.kind !== expectedKind) {
    // Don't keep a token we won't use — revoke it best-effort, commit nothing.
    await revoke()
    throw new RoleMismatchError(res.kind)
  }

  // Fetch the profile with the fresh token BEFORE committing anything, so the
  // store never exposes a half-built session (clients:[] / no active workspace).
  let me
  try {
    me = await api.me(res.token)
  } catch (e) {
    await revoke()
    throw e
  }

  setSession({
    token: res.token,
    kind: res.kind,
    name: res.name,
    userId: res.user_id,
    activeClientId:
      me.kind === 'client'
        ? me.active_client_id
        : me.active_client_id ?? me.clients[0]?.id ?? null,
    clients: me.clients,
  })
  queryClient.clear()
  return res.kind
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } catch {
    /* best effort — clear locally regardless */
  }
  setSession(null)
  queryClient.clear()
}

/** Team only: change which client workspace is being viewed. */
export function setActiveClient(clientId: string): void {
  patchSession({ activeClientId: clientId })
  queryClient.clear()
}

/** Refresh the reachable-workspace list (after creating/deleting clients). Also
 *  re-validates the active workspace — if a team member was viewing a client that
 *  has since been deleted/disabled, fall back to the first available one. */
export async function refreshClients(): Promise<void> {
  const s = getSession()
  if (!s) return
  const me = await api.me()
  // The workspace must still be ACTIVE, not merely present. GET /api/auth/me
  // returns disabled clients too (the Clients page needs them), but the backend
  // drops an X-Client-Id pointing at a disabled workspace — so staying pinned to
  // one made every scoped request fail with 400 "No active client workspace",
  // leaving the calendar and grid silently empty until the user guessed to
  // switch workspace. Fall back to the first workspace that actually works.
  const stillValid =
    s.activeClientId != null &&
    me.clients.some((c) => c.id === s.activeClientId && c.status === 'active')
  const firstUsable = me.clients.find((c) => c.status === 'active')?.id ?? null
  const prev = s.activeClientId
  const next =
    s.kind === 'client'
      ? s.activeClientId // clients are pinned to their own workspace
      : stillValid
        ? s.activeClientId
        : firstUsable
  patchSession({ clients: me.clients, activeClientId: next })
  // Repointing the workspace has to honour the same invariant as
  // setActiveClient: the cache is keyed per workspace only implicitly, so
  // without this the previous client's content stays on screen under the NEW
  // client's name and branding after theirs is deleted or disabled. Clearing
  // only when the id actually moved keeps the common no-op refresh cheap —
  // this also runs on every AppShell mount.
  if (next !== prev) queryClient.clear()
}

// ── Role helpers ─────────────────────────────────────────────────────────────
// Demo mode (no backend) stays read-only, exactly as before auth existed.

/** True when the current viewer may create/edit/delete content. */
export function useCanEdit(): boolean {
  const session = useAuth()
  if (!isApiConfigured) return false
  return session?.kind === 'team'
}

/** True for an Apar team session (unlocks admin areas + the workspace switcher). */
export function useIsTeam(): boolean {
  const session = useAuth()
  return isApiConfigured && session?.kind === 'team'
}

/** True for a client (review-only) session. */
export function useIsClient(): boolean {
  const session = useAuth()
  return isApiConfigured && session?.kind === 'client'
}

/** The name of the workspace currently being viewed (null in demo mode). */
export function useActiveWorkspaceName(): string | null {
  const session = useAuth()
  if (!session) return null
  return session.clients.find((c) => c.id === session.activeClientId)?.name ?? null
}
