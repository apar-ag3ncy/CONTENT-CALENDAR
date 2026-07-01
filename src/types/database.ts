// -----------------------------------------------------------------------------
// Document types for the Firestore collections. Firestore is schemaless, so
// these are the app's source of truth for shape. Each doc's Firestore id is
// surfaced as `id` (for day_notes/app_info the id is meaningful — see below).
// -----------------------------------------------------------------------------

export type ContentType = 'post' | 'reel' | 'story' | 'caption'

/** Posts can be a single image ("static") or a multi-image "carousel". */
export type PostFormat = 'static' | 'carousel'

export type MediaType = 'photo' | 'video'

export type ContentStatus =
  | 'scheduled'
  | 'posted'
  | 'backup'

/** Client review state for a single piece of content. */
export type ApprovalState = 'pending' | 'approved' | 'changes_requested'

export type LockScope = 'month' | 'week' | 'range'

/** One uploaded file (stored in MongoDB GridFS). A carousel has several. */
export interface MediaItem {
  url: string // public download URL
  path: string // storage path (for deletion)
  name: string
}

export interface ContentItem {
  id: string
  date: string // 'YYYY-MM-DD'
  day_of_week: string | null
  type: ContentType
  post_format: PostFormat | null // only meaningful when type === 'post'
  media_type: MediaType | null
  media: MediaItem[] // uploaded files (0..n; carousels have several)
  title: string | null
  caption: string | null
  drive_link: string | null
  category_id: string | null
  status: ContentStatus
  assigned_to: string | null
  notes: string | null
  grid_position: number | null // feed order for posts/reels in the Overview
  approval_state: ApprovalState // client review state
  approval_updated_at: string | null
  approval_updated_by: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  color: string
  created_at: string
}

export interface SpecialDay {
  id: string
  date: string
  label: string
  color: string
  created_at: string
}

export interface PeriodLock {
  id: string
  scope: LockScope
  start_date: string
  end_date: string
  finalized_by: string | null
  finalized_at: string
  note: string | null
}

export interface DayNote {
  date: string // primary key === date
  note: string
  drive_link: string | null // one Google Drive folder link for the whole day
  updated_by: string | null
  updated_at: string
}

export interface TeamMember {
  id: string
  name: string
  created_at: string
}

export interface AppInfo {
  id: string
  content: string
  updated_at: string
}

// ── Access control ──────────────────────────────────────────────────────────

export type AccountKind = 'team' | 'client'
export type AccountStatus = 'active' | 'disabled'

/** Per-client brand theme. Drives the whole app's colours for that workspace. */
export interface BrandColors {
  brand_color: string | null // primary accent (replaces the Apar orange)
  text_color: string | null // headings / font colour
  bg_color: string | null // page background tint
}

/** A client account == an isolated workspace. The team can read its password. */
export interface Client extends BrandColors {
  id: string
  name: string
  username: string
  /** Plaintext — recoverable so the team can view/share it. `null` means the
   *  stored value couldn't be decrypted (lost/changed secret_key) → reset it. */
  password: string | null
  status: AccountStatus
  created_at: string
  updated_at: string
}

/** A brief client record (no password) — used in the workspace switcher. */
export interface ClientBrief extends BrandColors {
  id: string
  name: string
  username: string
  status: AccountStatus
}

/** One note in a day's client↔team thread. */
export interface DayComment {
  id: string
  date: string
  author_kind: AccountKind
  author_name: string | null
  body: string
  acknowledged: boolean
  acknowledged_by: string | null
  created_at: string
}

/** An Apar team login. Password is never returned (one-way hashed server-side). */
export interface TeamUser {
  id: string
  name: string
  username: string
  status: AccountStatus
  created_at: string
  updated_at: string
}

/** Response of GET /auth/me — who am I + which workspaces can I reach. */
export interface SessionInfo {
  kind: AccountKind
  name: string
  user_id: string
  active_client_id: string | null
  clients: ClientBrief[]
}

/** Response of POST /auth/login. */
export interface LoginResult {
  token: string
  kind: AccountKind
  name: string
  user_id: string
  client_id?: string
}

/** One comment in a content item's review thread. */
export interface ContentComment {
  id: string
  content_id: string
  author_kind: AccountKind
  author_name: string | null
  body: string
  created_at: string
}
