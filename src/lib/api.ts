// Fetch client for the MongoDB-backed content-calendar API (server/).
// When VITE_API_URL is set, the app talks to this real backend (data + photos
// persist in MongoDB Atlas and are shared across everyone). When it's NOT set,
// the app falls back to the read-only demo seed data in demoData.ts.
import type {
  AppInfo,
  Category,
  ContentItem,
  DayNote,
  LockScope,
  MediaItem,
  PeriodLock,
  SpecialDay,
  TeamMember,
} from '../types/database'

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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
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

/** A content item ready to insert — server fills in id + timestamps. */
export type NewContentItem = Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString()

export const api = {
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
