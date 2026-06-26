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
  | 'idea'
  | 'drafting'
  | 'ready'
  | 'scheduled'
  | 'posted'

export type LockScope = 'month' | 'week' | 'range'

/** One uploaded file (Firebase Storage). A carousel has several. */
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
  date: string // Firestore doc id === date
  note: string
  updated_by: string | null
  updated_at: string
}

export interface TeamMember {
  id: string
  name: string
  created_at: string
}

export interface AppInfo {
  id: string // always 'main'
  content: string
  updated_at: string
}
