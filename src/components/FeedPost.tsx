// Instagram-accurate presentation of a day's content for client review.
//  • Feed posts & reels render as real IG post cards: media at its TRUE aspect
//    ratio (no distortion), reels tall, carousels as a fade gallery with a
//    blurred letterbox fill so nothing is ever cropped.
//  • Stories show as a 9:16 strip that opens a full-screen viewer.
//  • Captions sit under each post exactly as they'd appear on Instagram.
// All surfaces use the app's dark-aware tokens (card / bg-white / slate / brand).
import { useEffect, useState, type ReactNode } from 'react'
import type { ContentItem, ContentStatus, MediaItem } from '../types/database'
import { POST_FORMAT_META, STATUS_META, STATUS_ORDER, statusMeta } from '../lib/contentMeta'
import { Carousel, CarouselVideo } from './Carousel'

// ── media helpers ──────────────────────────────────────────────────────────
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
const VID_RE = /\.(mp4|webm|mov|m4v)$/i
const isImage = (m: MediaItem) => IMG_RE.test(m.name) || IMG_RE.test(m.url)
const isVideo = (m: MediaItem) => VID_RE.test(m.name) || VID_RE.test(m.url)
const posterFor = (m: MediaItem) => m.url.replace(VID_RE, '.poster.jpg')
/** Clamp a width/height ratio to Instagram's range: 9:16 portrait … 1.91:1 wide. */
const clampRatio = (r: number) => Math.max(0.5625, Math.min(1.91, r || 0.8))
const handleOf = (brand: string) => brand.toLowerCase().replace(/[^a-z0-9._]/g, '')

function downloadMedia(media: MediaItem[]) {
  media.forEach((m, i) => {
    const a = document.createElement('a')
    a.href = m.url
    a.download = m.name || `media-${i + 1}`
    a.rel = 'noopener'
    document.body.appendChild(a)
    window.setTimeout(() => {
      a.click()
      a.remove()
    }, i * 250)
  })
}

/** Small "copy to clipboard" button with a copied confirmation. */
export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked */
        }
      }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
        done ? 'text-emerald-600' : 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5'
      } ${className}`}
    >
      {done ? (
        '✓ Copied'
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

/** Render a caption with #hashtags and @mentions tinted Instagram-blue. */
function renderCaption(text: string): ReactNode {
  return text.split(/(\s+)/).map((tok, i) =>
    /^[#@][\w.]+$/.test(tok) ? (
      <span key={i} className="text-sky-600 dark:text-sky-400">
        {tok}
      </span>
    ) : (
      <span key={i}>{tok}</span>
    ),
  )
}

// ── icons ───────────────────────────────────────────────────────────────────
const ic = 'h-6 w-6'
const Heart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ic}><path d="M12 21s-7-4.35-9.5-8.5C.9 9.6 2.2 6 5.5 6 7.5 6 9 7.2 12 10c3-2.8 4.5-4 6.5-4 3.3 0 4.6 3.6 3 6.5C19 16.65 12 21 12 21Z" /></svg>
)
const Comment = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ic}><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5Z" /></svg>
)
const Share = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={ic}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
)
const Bookmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={ic}><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>
)
const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 4v11m0 0 4-4m-4 4-4-4" /><path d="M5 19.5h14" /></svg>
)
const ReelGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M10.5 8.6v6.8a.5.5 0 0 0 .77.42l5.2-3.4a.5.5 0 0 0 0-.84l-5.2-3.4a.5.5 0 0 0-.77.42Z" /></svg>
)
const CarouselGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="7" y="4" width="13" height="13" rx="2.5" /><path d="M4 7v11a2 2 0 0 0 2 2h11" /></svg>
)

// ── brand avatar (gradient ring like an IG profile) ──────────────────────────
function Avatar({ brand, size = 'h-9 w-9', ring = true }: { brand: string; size?: string; ring?: boolean }) {
  return (
    <span className={`relative inline-grid flex-none place-items-center rounded-full ${ring ? 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[2px]' : ''}`}>
      <span className={`grid ${size} place-items-center rounded-full bg-forest-700 font-serif text-sm text-cream`}>
        {brand.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function StatusPill({ status }: { status: ContentStatus }) {
  const m = statusMeta(status)
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.chip}`}>{m.label}</span>
}

function typeMeta(item: ContentItem): { label: string; glyph?: () => JSX.Element } {
  if (item.type === 'reel') return { label: 'Reel', glyph: ReelGlyph }
  if (item.type === 'post' && item.media.length > 1) return { label: 'Carousel', glyph: CarouselGlyph }
  if (item.type === 'post') return { label: 'Post' }
  if (item.type === 'story') return { label: 'Story' }
  return { label: 'Caption' }
}

// ── feed media: true-ratio, fade carousel, blurred letterbox fill ────────────
function FeedMedia({ item }: { item: ContentItem }) {
  const media = item.media
  const defaultRatio = item.type === 'reel' || item.type === 'story' ? 9 / 16 : 0.8
  const [ratio, setRatio] = useState<number>(defaultRatio)

  // Reels & stories are ALWAYS 9:16 (like Instagram) — never measured. Posts
  // take the upload's true aspect ratio. A fresh Image/Video element fires its
  // load event even when the file is cached (an <img onLoad> on a cached image
  // often doesn't), so the post frame always matches the upload.
  useEffect(() => {
    if (item.type === 'reel' || item.type === 'story') return
    const first = media[0]
    if (!first) return
    let cancelled = false
    if (isVideo(first)) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        if (!cancelled && v.videoWidth) setRatio(clampRatio(v.videoWidth / v.videoHeight))
      }
      v.src = first.url
    } else {
      const im = new Image()
      im.onload = () => {
        if (!cancelled && im.naturalWidth) setRatio(clampRatio(im.naturalWidth / im.naturalHeight))
      }
      im.src = first.url
    }
    return () => {
      cancelled = true
    }
  }, [media, item.type])

  if (media.length === 0) {
    return (
      <div className="grid aspect-square w-full place-items-center bg-slate-100 text-sm text-slate-400 dark:bg-white/5">
        No media uploaded yet
      </div>
    )
  }

  return (
    <Carousel
      count={media.length}
      ariaLabel={`${item.type} media`}
      renderSlide={(i, active) => {
        const m = media[i]
        return (
          <div className="relative bg-black" style={{ aspectRatio: String(ratio) }}>
            {/* blurred self-fill so off-ratio slides letterbox beautifully */}
            {isImage(m) ? (
              <>
                <img src={m.url} aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                <img src={m.url} alt={item.title ?? 'Post media'} loading="lazy" className="relative h-full w-full object-contain" />
              </>
            ) : (
              <CarouselVideo src={m.url} poster={posterFor(m)} active={active} className="relative h-full w-full object-contain" />
            )}
          </div>
        )
      }}
    />
  )
}

// ── full Instagram-style post card (post / reel) ─────────────────────────────
export function FeedPostCard({
  item,
  brand,
  dateLabel,
  canEdit,
  onEdit,
  onRemove,
  onStatus,
}: {
  item: ContentItem
  brand: string
  dateLabel: string
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
  onStatus: (item: ContentItem, status: ContentStatus) => void
}) {
  const t = typeMeta(item)
  return (
    <article className="mx-auto w-full max-w-[30rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_36px_-26px_rgba(16,24,40,0.4)] dark:border-white/10">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar brand={brand} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-slate-900">{brand}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
              {t.glyph ? t.glyph() : null}
              {t.label}
            </span>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
          </p>
        </div>
        <StatusPill status={item.status} />
        {item.media.length > 0 ? (
          <button
            type="button"
            onClick={() => downloadMedia(item.media)}
            title="Download media"
            aria-label="Download media"
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-white/10"
          >
            <IconDownload />
          </button>
        ) : null}
      </div>

      {/* media */}
      <FeedMedia item={item} />

      {/* decorative IG action row */}
      <div aria-hidden className="flex items-center gap-4 px-4 pt-3 text-slate-800 dark:text-slate-200">
        <Heart />
        <Comment />
        <Share />
        <span className="ml-auto">
          <Bookmark />
        </span>
      </div>

      {/* caption */}
      <div className="px-4 pb-3 pt-2">
        {item.caption ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            <span className="mr-1.5 font-semibold text-slate-900">{handleOf(brand)}</span>
            {renderCaption(item.caption)}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">No caption.</p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {item.title ? (
            <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.title}</p>
          ) : <span />}
          {item.caption ? <CopyButton text={item.caption} label="Copy caption" className="flex-none" /> : null}
        </div>
        {item.notes ? (
          <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            📝 {item.notes}
          </p>
        ) : null}
      </div>

      {/* team-only edit controls (subtle footer) */}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            Status
            <select
              value={item.status}
              onChange={(e) => onStatus(item, e.target.value as ContentStatus)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
          {item.type === 'post' && item.post_format ? (
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:ring-white/10">
              {POST_FORMAT_META[item.post_format].icon} {POST_FORMAT_META[item.post_format].label}
            </span>
          ) : null}
          <button type="button" onClick={() => onEdit(item)} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-white/10">
            Edit
          </button>
          <button type="button" onClick={() => onRemove(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
            Remove
          </button>
        </div>
      ) : null}
    </article>
  )
}

// ── text-only caption post ───────────────────────────────────────────────────
export function CaptionCard({
  item,
  brand,
  canEdit,
  onEdit,
  onRemove,
}: {
  item: ContentItem
  brand: string
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
}) {
  return (
    <article className="mx-auto w-full max-w-[30rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar brand={brand} ring={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{brand}</p>
          <p className="text-[11px] text-slate-400">Caption</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="px-4 pb-2">
        {item.title ? <p className="text-sm font-bold text-slate-900">{item.title}</p> : null}
        {item.caption ? (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{renderCaption(item.caption)}</p>
        ) : (
          <p className="mt-1 text-sm italic text-slate-400">No caption written yet.</p>
        )}
        {item.caption ? <CopyButton text={item.caption} label="Copy caption" className="mt-1.5" /> : null}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
          <button type="button" onClick={() => onEdit(item)} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-white/10">
            Edit
          </button>
          <button type="button" onClick={() => onRemove(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
            Remove
          </button>
        </div>
      ) : null}
    </article>
  )
}

// ── stories: 9:16 strip + full-screen viewer ─────────────────────────────────
function StoryThumb({
  item,
  onOpen,
  canEdit,
  onEdit,
  onRemove,
}: {
  item: ContentItem
  onOpen: () => void
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
}) {
  const vid = item.media.find(isVideo)
  const img = item.media.find(isImage)
  return (
    <div className="group relative w-32 flex-none sm:w-36">
      <button type="button" onClick={onOpen} className="block w-full">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-forest-100 ring-1 ring-champagne/40">
          {vid ? (
            <video ref={(v) => v && (v.muted = true)} src={vid.url} poster={posterFor(vid)} muted loop autoPlay playsInline className="h-full w-full object-cover" />
          ) : img ? (
            <img src={img.url} alt={item.title ?? 'Story'} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-xs text-forest-400">No media</span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-900/70 via-transparent to-forest-900/10" />
          <span className="absolute left-2 top-2 inline-flex rounded-full bg-forest-900/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cream backdrop-blur-sm">
            Story
          </span>
          <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
            <p className="truncate font-serif text-sm font-semibold text-cream">{item.title || 'Story'}</p>
            <span className="mt-1 inline-flex"><StatusPill status={item.status} /></span>
          </div>
        </div>
      </button>

      {/* team controls — edit / remove this story */}
      {canEdit ? (
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit story"
            aria-label="Edit story"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRemove(item)}
            title="Remove story"
            aria-label="Remove story"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function StoryViewer({ stories, startIndex, brand, onClose }: { stories: ContentItem[]; startIndex: number; brand: string; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex)
  const cur = stories[idx]
  const go = (d: number) => setIdx((i) => Math.min(Math.max(i + d, 0), stories.length - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [stories.length, onClose])

  if (!cur) return null
  const vid = cur.media.find(isVideo)
  const img = cur.media.find(isImage)

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 p-3">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/30">
        ✕
      </button>
      <div className="relative aspect-[9/16] h-[86vh] max-h-[86vh] max-w-[94vw] overflow-hidden rounded-2xl bg-black shadow-2xl">
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
          {stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className={`block h-full rounded-full bg-white ${i <= idx ? 'w-full' : 'w-0'}`} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pb-2 pt-6 text-white">
          <Avatar brand={brand} size="h-8 w-8" />
          <span className="text-sm font-semibold">{brand}</span>
          <span className="ml-auto text-[11px] text-white/60">{idx + 1}/{stories.length}</span>
        </div>
        {vid ? (
          <video key={cur.id} ref={(v) => v && (v.muted = false)} src={vid.url} poster={posterFor(vid)} autoPlay playsInline loop controls className="h-full w-full object-contain" />
        ) : img ? (
          <img key={cur.id} src={img.url} alt={cur.title ?? 'Story'} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-white/60">No media</div>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white">
          {cur.title ? <p className="font-serif text-lg font-semibold drop-shadow">{cur.title}</p> : null}
          {cur.caption ? <p className="mt-1 text-sm text-white/90 drop-shadow">{renderCaption(cur.caption)}</p> : null}
        </div>
        <button type="button" aria-label="Previous" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-[5] w-1/3 cursor-default focus:outline-none" />
        <button type="button" aria-label="Next" onClick={() => go(1)} className="absolute inset-y-0 right-0 z-[5] w-1/3 cursor-default focus:outline-none" />
      </div>
      {cur.media.length > 0 ? (
        <button type="button" onClick={() => downloadMedia(cur.media)} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">
          <IconDownload /> Download story
        </button>
      ) : null}
    </div>
  )
}

// ── section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 px-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{children}</span>
      <span className="h-px flex-1 bg-slate-200/70 dark:bg-white/10" />
    </div>
  )
}

const feedOrder = (a: ContentItem, b: ContentItem) => {
  const ap = a.grid_position ?? Number.MAX_SAFE_INTEGER
  const bp = b.grid_position ?? Number.MAX_SAFE_INTEGER
  if (ap !== bp) return ap - bp
  return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
}

/** The whole day as an Instagram-style feed: posts/reels, then stories, then captions. */
export function DayFeed({
  items,
  brand,
  dateLabel,
  canEdit,
  onEdit,
  onRemove,
  onStatus,
}: {
  items: ContentItem[]
  brand: string
  dateLabel: string
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
  onStatus: (item: ContentItem, status: ContentStatus) => void
}) {
  const [storyAt, setStoryAt] = useState<number | null>(null)
  const feed = items.filter((i) => i.type === 'post' || i.type === 'reel').sort(feedOrder)
  const stories = items.filter((i) => i.type === 'story').sort(feedOrder)
  const captions = items.filter((i) => i.type === 'caption').sort(feedOrder)

  return (
    <div className="space-y-8">
      {feed.length > 0 ? (
        <section>
          <SectionLabel>The feed · {feed.length}</SectionLabel>
          <div className="space-y-6">
            {feed.map((item) => (
              <FeedPostCard
                key={item.id}
                item={item}
                brand={brand}
                dateLabel={dateLabel}
                canEdit={canEdit}
                onEdit={onEdit}
                onRemove={onRemove}
                onStatus={onStatus}
              />
            ))}
          </div>
        </section>
      ) : null}

      {stories.length > 0 ? (
        <section>
          <SectionLabel>Stories · {stories.length}</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stories.map((s, i) => (
              <StoryThumb key={s.id} item={s} onOpen={() => setStoryAt(i)} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </div>
        </section>
      ) : null}

      {captions.length > 0 ? (
        <section>
          <SectionLabel>Captions · {captions.length}</SectionLabel>
          <div className="space-y-6">
            {captions.map((item) => (
              <CaptionCard key={item.id} item={item} brand={brand} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </div>
        </section>
      ) : null}

      {storyAt !== null ? (
        <StoryViewer stories={stories} startIndex={storyAt} brand={brand} onClose={() => setStoryAt(null)} />
      ) : null}
    </div>
  )
}
