// Fetch client for the MongoDB-backed content-calendar API (server/).
// When VITE_API_URL is set, the app talks to this real backend (data + photos
// persist in MongoDB Atlas and are shared across everyone). When it's NOT set,
// the app falls back to the read-only demo seed data in demoData.ts.
import type {
  AppInfo,
  ApprovalState,
  Category,
  Client,
  ContentComment,
  ContentItem,
  DayComment,
  DayNote,
  LockScope,
  LoginResult,
  MediaItem,
  PeriodLock,
  SessionInfo,
  SpecialDay,
  TeamMember,
  TeamUser,
} from '../types/database'
import { getActiveClientId, getSession, getToken, setSession } from './authStore'

const RAW = import.meta.env.VITE_API_URL as string | undefined
// Same-origin mode: when VITE_SAME_ORIGIN is set, the API lives on the SAME
// domain as the app (the cPanel PHP setup). API_BASE stays empty so requests go
// to relative "/api/..." — portable to any domain without baking in a URL.
const SAME = (import.meta.env.VITE_SAME_ORIGIN as string | undefined)?.toLowerCase()
const sameOrigin = SAME === '1' || SAME === 'true'
/** Base URL with any trailing slash removed ('' = same-origin or not configured). */
export const API_BASE = sameOrigin ? '' : (RAW ?? '').trim().replace(/\/+$/, '')
/** True once a backend is configured — unlocks real reading & editing. */
export const isApiConfigured = sameOrigin || API_BASE.length > 0

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const token = getToken()
  const clientId = getActiveClientId()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Tells the backend which client workspace to read/write (team can switch;
      // ignored server-side for client sessions, which are bound to their own).
      ...(clientId ? { 'X-Client-Id': clientId } : {}),
      ...(init?.headers ?? {}),
    },
  })
  // Session died (expired/revoked) — drop it and bounce to the right login page
  // (admins → /admin, clients → /). The login call itself returns 401 on bad
  // credentials, so we never redirect from there.
  if (res.status === 401 && token && path !== '/api/auth/login') {
    const target = getSession()?.kind === 'team' ? '/admin' : '/'
    setSession(null)
    if (typeof window !== 'undefined' && window.location.pathname !== target) {
      window.location.assign(target)
    }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const e = await res.json()
      if (e?.error) msg = e.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** A content item ready to insert — server fills in id, timestamps, and the
 *  client-review fields (approval defaults to 'pending'). */
export type NewContentItem = Omit<
  ContentItem,
  'id' | 'created_at' | 'updated_at' | 'approval_state' | 'approval_updated_at' | 'approval_updated_by'
>

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString()

export const api = {
  // ── Auth ──
  login: (username: string, password: string) =>
    req<LoginResult>(`/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<void>(`/api/auth/logout`, { method: 'POST' }),
  // `token` lets login() fetch the profile before the session is committed to the
  // store (so the store never holds a half-built session).
  me: (token?: string) =>
    req<SessionInfo>(`/api/auth/me`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),

  // ── Clients (team only) ──
  clients: () => req<Client[]>(`/api/clients`),
  createClient: (c: {
    name: string
    username: string
    password: string
    brand_color?: string | null
    text_color?: string | null
    bg_color?: string | null
  }) => req<Client>(`/api/clients`, { method: 'POST', body: JSON.stringify(c) }),
  updateClient: (
    id: string,
    patch: {
      name?: string
      username?: string
      password?: string
      status?: 'active' | 'disabled'
      brand_color?: string | null
      text_color?: string | null
      bg_color?: string | null
    },
  ) => req<Client>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteClient: (id: string) => req<void>(`/api/clients/${id}`, { method: 'DELETE' }),

  // ── Day notes thread (client suggestions + team replies/acknowledge) ──
  dayComments: (date: string) => req<DayComment[]>(`/api/day-comments/${date}`),
  addDayComment: (date: string, body: string) =>
    req<DayComment>(`/api/day-comments/${date}`, { method: 'POST', body: JSON.stringify({ body }) }),
  ackDayComment: (id: string, acknowledged: boolean) =>
    req<void>(`/api/day-comments/${id}`, { method: 'PATCH', body: JSON.stringify({ acknowledged }) }),
  deleteDayComment: (id: string) => req<void>(`/api/day-comments/${id}`, { method: 'DELETE' }),

  // ── Team users (team only) ──
  teamUsers: () => req<TeamUser[]>(`/api/team-users`),
  createTeamUser: (u: { name: string; username: string; password: string }) =>
    req<TeamUser>(`/api/team-users`, { method: 'POST', body: JSON.stringify(u) }),
  updateTeamUser: (
    id: string,
    patch: { name?: string; username?: string; password?: string; status?: 'active' | 'disabled' },
  ) => req<TeamUser>(`/api/team-users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTeamUser: (id: string) => req<void>(`/api/team-users/${id}`, { method: 'DELETE' }),

  // ── Review (client + team) ──
  setApproval: (id: string, state: ApprovalState) =>
    req<ContentItem>(`/api/content/${id}/approval`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    }),
  comments: (id: string) => req<ContentComment[]>(`/api/content/${id}/comments`),
  addComment: (id: string, body: string) =>
    req<ContentComment>(`/api/content/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  deleteComment: (id: string, commentId: string) =>
    req<void>(`/api/content/${id}/comments/${commentId}`, { method: 'DELETE' }),

  // ── Content ──
  contentRange: (start: string, end: string) =>
    req<ContentItem[]>(`/api/content?${qs({ start, end })}`),
  contentByDate: (date: string) => req<ContentItem[]>(`/api/content?${qs({ date })}`),
  allContent: () => req<ContentItem[]>(`/api/content`),
  grid: () => req<ContentItem[]>(`/api/content/grid`),
  createItem: (item: NewContentItem) =>
    req<ContentItem>(`/api/content`, { method: 'POST', body: JSON.stringify(item) }),
  updateItem: (id: string, patch: Partial<ContentItem>) =>
    req<ContentItem>(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteItem: (id: string, mediaPaths?: string[]) =>
    req<void>(`/api/content/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ mediaPaths: mediaPaths ?? [] }),
    }),
  reorderGrid: (orderedIds: string[]) =>
    req<void>(`/api/content/grid/reorder`, { method: 'POST', body: JSON.stringify({ orderedIds }) }),

  // ── Day notes ──
  dayNote: (date: string) => req<DayNote | null>(`/api/day-notes/${date}`),
  upsertDayNote: (date: string, note: string, drive_link: string | null = null) =>
    req<DayNote>(`/api/day-notes/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ note, drive_link }),
    }),

  // ── Categories ──
  categories: () => req<Category[]>(`/api/categories`),
  createCategory: (c: { name: string; color: string }) =>
    req<Category>(`/api/categories`, { method: 'POST', body: JSON.stringify(c) }),
  updateCategory: (id: string, patch: { name?: string; color?: string }) =>
    req<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCategory: (id: string) => req<void>(`/api/categories/${id}`, { method: 'DELETE' }),

  // ── Team members ──
  teamMembers: () => req<TeamMember[]>(`/api/team-members`),
  createTeamMember: (name: string) =>
    req<TeamMember>(`/api/team-members`, { method: 'POST', body: JSON.stringify({ name }) }),
  updateTeamMember: (id: string, name: string) =>
    req<TeamMember>(`/api/team-members/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTeamMember: (id: string) => req<void>(`/api/team-members/${id}`, { method: 'DELETE' }),

  // ── Shared info note ──
  appInfo: () => req<AppInfo | null>(`/api/app-info`),
  upsertAppInfo: (content: string) =>
    req<AppInfo>(`/api/app-info`, { method: 'PUT', body: JSON.stringify({ content }) }),

  // ── Special days ──
  specialDays: (start: string, end: string) =>
    req<SpecialDay[]>(`/api/special-days?${qs({ start, end })}`),

  // ── Period locks ──
  locks: (start: string, end: string) => req<PeriodLock[]>(`/api/locks?${qs({ start, end })}`),
  createLock: (lock: { scope: LockScope; start_date: string; end_date: string; note: string | null }) =>
    req<PeriodLock>(`/api/locks`, { method: 'POST', body: JSON.stringify(lock) }),
  deleteLock: (id: string) => req<void>(`/api/locks/${id}`, { method: 'DELETE' }),

  // ── Media (photos/videos in GridFS) ──
  uploadMedia: (file: File): Promise<MediaItem> => {
    const fd = new FormData()
    fd.append('file', file)
    return req<MediaItem>(`/api/media`, { method: 'POST', body: fd })
  },
  deleteMedia: (path: string) => req<void>(`/api/media/${path}`, { method: 'DELETE' }),
}
