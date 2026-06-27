// Sample content shown so the calendar and the Instagram-style grid review can
// be explored with realistic example data, using the real files in /public/photos.
//
// This is the seed data the read hooks serve while DEMO_MODE is on — it acts as
// the app's content "backend" until a live database is connected (flip DEMO_MODE
// to false). The two seeded days match the exact content plan requested:
//   • July 2 — 1 Post, 1 Reel, 2 Stories
//   • July 3 — 1 Carousel (4 posts), 4 Stories
import type {
  ContentItem,
  ContentType,
  ContentStatus,
  MediaItem,
  MediaType,
  PostFormat,
} from '../types/database'

/**
 * Demo mode: serve the sample content below instead of hitting Firestore.
 * Forced ON because the Firestore database isn't live yet (queries would hang).
 * Set this to `false` once a working content database is connected.
 */
export const DEMO_MODE = true

/** The two review dates shown in the Grid Review page. */
export const REVIEW_DATES = ['2026-07-02', '2026-07-03'] as const

const STAMP = '2026-01-01T00:00:00.000Z'

/** A real file from /public/photos (filename URL-encoded so spaces work). */
function asset(file: string): MediaItem {
  return { url: `/photos/${encodeURIComponent(file)}`, path: `photos/${file}`, name: file }
}

let seq = 0
function mk(p: {
  date: string
  day: string
  type: ContentType
  title: string
  caption?: string
  format?: PostFormat | null
  mediaType?: MediaType | null
  media?: MediaItem[]
  status?: ContentStatus
  grid?: number | null
}): ContentItem {
  seq += 1
  return {
    id: `demo-${seq}`,
    date: p.date,
    day_of_week: p.day,
    type: p.type,
    post_format: p.format ?? (p.type === 'post' ? 'static' : null),
    media_type:
      p.mediaType ??
      (p.type === 'reel' ? 'video' : p.type === 'caption' ? null : 'photo'),
    media: p.media ?? [],
    title: p.title,
    caption: p.caption ?? null,
    drive_link: null,
    category_id: null,
    status: p.status ?? 'idea',
    assigned_to: null,
    notes: null,
    grid_position: p.grid ?? null,
    created_at: STAMP,
    updated_at: STAMP,
  }
}

// The real files dropped in /public/photos.
const A = '15 JAN MIREYAA GRID-01.jpg'
const B = '15 JAN MIREYAA GRID-05.jpg'
const C = '15 JAN MIREYAA GRID-07.jpg'
const D = 'magnific_use-img1-as-the-sole-refe_mC2WOgEhJQ.jpeg'
const E = 'magnific_use-img1-as-the-sole-refe_nTlJ5s6YQD.jpeg'
const F = 'appleArtboard 1 copy 12.png'
const VID = '1782300006428813-ezremove.mp4'

export const DEMO_ITEMS: ContentItem[] = [
  // ─────────────── Day 1 — Thursday, July 2 2026 ───────────────
  // 1 Post · 1 Reel · 2 Stories
  mk({
    date: '2026-07-02', day: 'Thursday', type: 'post', format: 'static',
    title: 'Statement set', caption: 'The piece that turns every head. ✨\n\n#Mireyaa #FineJewellery',
    status: 'scheduled', grid: 0, media: [asset(A)],
  }),
  mk({
    date: '2026-07-02', day: 'Thursday', type: 'reel',
    title: 'The reveal', caption: '15 seconds with the new collection. 🎬 Sound on.',
    status: 'ready', grid: 1, media: [asset(VID)],
  }),
  mk({
    date: '2026-07-02', day: 'Thursday', type: 'story',
    title: 'Sneak peek', caption: 'Dropping tomorrow.', status: 'ready', media: [asset(B)],
  }),
  mk({
    date: '2026-07-02', day: 'Thursday', type: 'story',
    title: 'BTS in the studio', caption: 'Styling the shoot.', status: 'drafting', media: [asset(D)],
  }),

  // ─────────────── Day 2 — Friday, July 3 2026 ───────────────
  // 1 Carousel (4 posts) · 4 Stories
  mk({
    date: '2026-07-03', day: 'Friday', type: 'post', format: 'carousel',
    title: 'The bridal edit', caption: 'Four ways to wear the collection. Swipe → 💍\n\n#BridalEdit #Mireyaa',
    status: 'drafting', grid: 2, media: [asset(E), asset(C), asset(F), asset(A)],
  }),
  mk({
    date: '2026-07-03', day: 'Friday', type: 'story',
    title: 'New drop is live', caption: 'Swipe up.', status: 'ready', media: [asset(B)],
  }),
  mk({
    date: '2026-07-03', day: 'Friday', type: 'story',
    title: 'Behind the bridal set', caption: 'On set today.', status: 'drafting', media: [asset(C)],
  }),
  mk({
    date: '2026-07-03', day: 'Friday', type: 'story',
    title: 'Poll: which piece?', caption: 'Tap to vote.', status: 'idea', media: [asset(D)],
  }),
  mk({
    date: '2026-07-03', day: 'Friday', type: 'story',
    title: 'Last call', caption: 'Closing the edit.', status: 'ready', media: [asset(E)],
  }),
]

export function demoItemsForDate(dateISO: string): ContentItem[] {
  return DEMO_ITEMS.filter((i) => i.date === dateISO)
}

export function demoItemsInRange(startISO: string, endISO: string): ContentItem[] {
  return DEMO_ITEMS.filter((i) => i.date >= startISO && i.date <= endISO)
}

/** Posts + reels (incl. carousels) for the Overview/Instagram feed, in order. */
export function demoGridItems(): ContentItem[] {
  return DEMO_ITEMS.filter((i) => i.type === 'post' || i.type === 'reel').sort(
    (a, b) => (a.grid_position ?? 99) - (b.grid_position ?? 99),
  )
}
