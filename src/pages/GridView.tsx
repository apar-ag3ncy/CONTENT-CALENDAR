import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAllContent } from '../hooks/useAdminData'
import { statusMeta } from '../lib/contentMeta'
import {
  addDays,
  formatWeekRange,
  isValidISODate,
  mondayOf,
  parseISODate,
  toISODate,
} from '../lib/dates'
import { useActiveWorkspaceName } from '../lib/auth'
import { Carousel, CarouselVideo } from '../components/Carousel'
import type { ContentItem, MediaItem } from '../types/database'

// ─────────────────────────── media helpers ───────────────────────────
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
const VID_RE = /\.(mp4|webm|mov|m4v)$/i

const isImg = (m: MediaItem) => IMG_RE.test(m.name) || IMG_RE.test(m.url)
const isVid = (m: MediaItem) => VID_RE.test(m.name) || VID_RE.test(m.url)
const firstImage = (item: ContentItem) => item.media.find(isImg) ?? null
const firstVideo = (item: ContentItem) => item.media.find(isVid) ?? null

/** A tile needs something to show — Instagram has no post without media. */
const hasMedia = (item: ContentItem) => Boolean(firstImage(item) || firstVideo(item))

/** Only posts and reels land on the profile grid (stories/captions never do). */
const isFeedType = (item: ContentItem) => item.type === 'post' || item.type === 'reel'

// ─────────────────────── which statuses count as "planned" ───────────────────────
/**
 * ALLOWLIST, deliberately — not a denylist. The database can hold more than the
 * ContentStatus union: the SQLite schema defaults `status` to 'idea'
 * (api/index.php:189) and the PATCH route validates nothing, so any string can
 * land here. A denylist would silently promote an unrecognised value into the
 * planned week; this errs the other way.
 *
 * Applied ONLY to the highlighted week band — NEVER to the feed below it. The
 * feed stays unfiltered by status so nothing can silently vanish from the grid,
 * and anything the allowlist rejects is surfaced in the "not shown" counter
 * rather than just disappearing.
 */
const PLANNED_STATUSES = new Set(['scheduled', 'posted'])

const monthShort = (iso: string) =>
  parseISODate(iso).toLocaleDateString('en-US', { month: 'short' })
const weekdayLong = (iso: string) =>
  parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long' })
const dayNum = (iso: string) => parseISODate(iso).getDate()

/** Download every media file of an item (same-origin /media files honour `download`). */
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
    }, i * 300)
  })
}

// ─────────────────────────── icons ───────────────────────────
const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19.5h14" />
  </svg>
)
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

function Photo({ src, alt = '', className = '' }: { src: string; alt?: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03] ${className}`}
    />
  )
}

/**
 * A reel that actually plays. React only sets `muted` as an attribute, which
 * Chrome's autoplay policy ignores — so we set the muted *property* via a ref.
 * A sibling poster frame (`<name>.poster.jpg`) guarantees a visible frame.
 */
function VideoThumb({ src, className = '' }: { src: string; className?: string }) {
  return (
    <video
      ref={(v) => {
        if (!v) return
        v.muted = true
        v.defaultMuted = true
        v.play().catch(() => {})
      }}
      src={src}
      poster={src.replace(VID_RE, '.poster.jpg')}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

function reelGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M10.5 8.6v6.8a.5.5 0 0 0 .77.42l5.2-3.4a.5.5 0 0 0 0-.84l-5.2-3.4a.5.5 0 0 0-.77.42Z" />
    </svg>
  )
}
function carouselGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="7" y="4" width="13" height="13" rx="2.5" />
      <path d="M4 7v11a2 2 0 0 0 2 2h11" />
    </svg>
  )
}

function TypeTag({ label, glyph }: { label: string; glyph?: () => JSX.Element }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
      {glyph ? glyph() : null}
      {label}
    </span>
  )
}

function StatusChip({ item }: { item: ContentItem }) {
  const meta = statusMeta(item.status)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${meta.chip}`}>
      {meta.label}
    </span>
  )
}

function metaFor(item: ContentItem): { label: string; glyph?: () => JSX.Element } {
  if (item.type === 'reel') return { label: 'Reel', glyph: reelGlyph }
  if (item.type === 'post' && item.media.length > 1) return { label: 'Carousel', glyph: carouselGlyph }
  if (item.type === 'post') return { label: 'Post' }
  if (item.type === 'story') return { label: 'Story' }
  return { label: 'Caption' }
}

// ─────────────────────────── ordering ───────────────────────────
/** date DESC, then newest-created first — the Instagram "newest at top" feed. */
function byDateDesc(a: ContentItem, b: ContentItem): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1
}

// ─────────────────────────── editorial header ───────────────────────────
function EditorialHeader({ brand }: { brand: string }) {
  return (
    <header className="editorial-hero relative isolate overflow-hidden rounded-[1.75rem] bg-forest-900 px-7 py-11 text-white sm:px-12 sm:py-16">
      {/* Brand-colour gradient wash over a dark base: carries the active
          workspace's colour while keeping the title crisply white. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/70 via-brand-600/40 to-transparent" />
      <span className="pointer-events-none absolute -right-2 -top-14 select-none font-serif text-[13rem] font-bold leading-none text-white/10 sm:-top-20 sm:text-[20rem]">
        G
      </span>
      <span className="pointer-events-none absolute inset-3 rounded-[1.4rem] ring-1 ring-white/15 sm:inset-4" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/75">
          {brand} × Apar · Feed Preview
        </p>
        <h1 className="mt-4 font-serif text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Grid Review
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85">
          Next week’s plan sitting on top of the live feed — exactly how the profile will look once it goes up.
        </p>
      </div>
    </header>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100">{n}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

/**
 * Clean Instagram grid tile — image/reel only, click to open. No text overlay.
 *
 * TILE RATIO IS 3:4 ON PURPOSE — it mirrors the Instagram MOBILE profile grid,
 * which moved from 1:1 to 3:4 in January 2025. Our clients review on a phone,
 * so mobile is the target. Desktop instagram.com is reported to still render
 * square thumbnails; that is a review-only surface for us, so we deliberately
 * do NOT branch the logic for it.
 *
 * What 3:4 costs each source shape (children are object-cover, so the tile
 * ratio IS the crop):
 *  • a 4:5 post  → ~6.25% of WIDTH trimmed, ~3% a side. Nothing is lost top or
 *    bottom. (The intuition that a taller tile trims top/bottom is backwards:
 *    3:4 = 0.750 w/h is NARROWER than 4:5 = 0.800, so height binds.)
 *  • a 9:16 reel cover → 25% of height, matching Instagram exactly. The old 4:5
 *    tile cut 29.7%, i.e. it under-promised what the cover would show.
 *
 * Instagram has since added an "Adjust Preview" control that lets a user
 * reposition the thumbnail inside the 3:4 frame, so a centre crop is the
 * default case rather than a guarantee.
 */
function FeedTile({
  item,
  onOpen,
  highlight = false,
}: {
  item: ContentItem
  onOpen: () => void
  highlight?: boolean
}) {
  const vid = firstVideo(item)
  const img = firstImage(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative aspect-[3/4] overflow-hidden rounded-lg bg-forest-100 ${
        // No ring-offset: it would need a colour matching the panel behind it,
        // which differs between light and dark. The 2px brand ring reads
        // clearly against the artwork on its own.
        highlight ? 'ring-2 ring-brand-500' : 'ring-1 ring-forest-100'
      }`}
    >
      {vid ? <VideoThumb src={vid.url} /> : img ? <Photo src={img.url} /> : null}
      {item.type === 'reel' || isCarousel ? (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-forest-900/55 text-cream backdrop-blur-sm">
          {item.type === 'reel' ? reelGlyph() : carouselGlyph()}
        </span>
      ) : null}
      <span className="pointer-events-none absolute inset-0 bg-forest-900/0 transition group-hover:bg-forest-900/15" />
    </button>
  )
}

// ─────────────────────────── grid size toggle ───────────────────────────
type GridSize = 'laptop' | 'mobile'
const GRID_SIZE_KEY = 'cc_grid_size'

const IconLaptop = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2.5 19.5h19" />
  </svg>
)
const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
)

/** Laptop = larger tiles (full width); Mobile = smaller, tighter tiles (phone width). */
function GridSizeToggle({ size, onChange }: { size: GridSize; onChange: (s: GridSize) => void }) {
  const opts: { v: GridSize; label: string; Icon: () => JSX.Element }[] = [
    { v: 'laptop', label: 'Laptop', Icon: IconLaptop },
    { v: 'mobile', label: 'Mobile', Icon: IconPhone },
  ]
  return (
    <div className="inline-flex flex-none items-center gap-0.5 rounded-full border border-forest-100 bg-forest-50 p-0.5 dark:border-white/10 dark:bg-white/5">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={size === v}
          title={`${label} view`}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
            size === v
              ? 'bg-forest-700 text-cream shadow-sm dark:bg-brand-500 dark:text-white'
              : 'text-forest-500 hover:text-forest-800 dark:text-neutral-400 dark:hover:text-neutral-100'
          }`}
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────── week band ───────────────────────────
const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M15 6 9 12l6 6" />
  </svg>
)
const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/** The selected week: its tiles, what got left out, and how to move between weeks. */
type WeekBand = {
  label: string
  items: ContentItem[]
  /** Human summary of week items kept off the grid, e.g. "2 idea · 1 no media". */
  notShown: string | null
  /** Stories/captions dated in this week — never on a profile grid by design. */
  nonFeedCount: number
  isDefault: boolean
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}

function WeekBandHeader({ week }: { week: WeekBand }) {
  const navBtn =
    'grid h-7 w-7 place-items-center rounded-full border border-forest-100 text-forest-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-neutral-400 dark:hover:text-neutral-100'
  return (
    <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-1 pt-2">
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
          {week.isDefault ? 'Next week' : 'Selected week'}
        </span>
      </span>
      <span className="font-serif text-sm font-bold text-neutral-900 dark:text-neutral-100">{week.label}</span>
      <span className="text-[11px] text-forest-400 dark:text-neutral-500">
        {week.items.length} {week.items.length === 1 ? 'post' : 'posts'}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-brand-300/60 to-transparent" />
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={week.onPrev} title="Previous week" aria-label="Previous week" className={navBtn}>
          <IconChevronLeft />
        </button>
        {!week.isDefault ? (
          <button
            type="button"
            onClick={week.onReset}
            className="rounded-full px-2 py-1 text-[11px] font-semibold text-forest-500 transition hover:text-brand-600 dark:text-neutral-400"
          >
            Next week
          </button>
        ) : null}
        <button type="button" onClick={week.onNext} title="Following week" aria-label="Following week" className={navBtn}>
          <IconChevronRight />
        </button>
      </span>
    </div>
  )
}

/** Says plainly what the week holds that the grid is NOT showing. */
function NotShownNote({ week }: { week: WeekBand }) {
  if (!week.notShown && !week.nonFeedCount) return null
  return (
    <p className="col-span-3 px-1 pb-1 text-[11px] leading-relaxed text-forest-400 dark:text-neutral-500">
      {/* Wording matters: these items are NOT hidden — anything with media still
          renders below. They just don't count as this week's plan. Saying "not
          shown" contradicted the tiles a few rows down. */}
      {week.notShown ? (
        <>Not counted in this week’s plan: {week.notShown} — still shown below. </>
      ) : null}
      {week.nonFeedCount ? (
        <>
          {week.nonFeedCount} {week.nonFeedCount === 1 ? 'story/caption' : 'stories/captions'} this week —
          never part of the profile grid.
        </>
      ) : null}
    </p>
  )
}

function ProfilePreview({
  brand,
  band,
  rest,
  week,
  hiddenNoMedia,
  onOpenItem,
}: {
  brand: string
  band: ContentItem[]
  rest: ContentItem[]
  week: WeekBand
  /** Feed-eligible items anywhere in history with nothing to render. */
  hiddenNoMedia: number
  onOpenItem: (item: ContentItem) => void
}) {
  const [size, setSize] = useState<GridSize>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(GRID_SIZE_KEY) === 'mobile' ? 'mobile' : 'laptop',
  )
  const changeSize = (s: GridSize) => {
    setSize(s)
    try {
      localStorage.setItem(GRID_SIZE_KEY, s)
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-[0_18px_40px_-28px_rgba(13,27,21,0.45)]">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          {/* profile photo */}
          <div className="relative rounded-full bg-gradient-to-tr from-champagne to-forest-600 p-[3px]">
            <div className="rounded-full bg-white p-[3px]">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-forest-700 font-serif text-3xl text-cream sm:h-24 sm:w-24 sm:text-4xl">
                {brand.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{brand}</p>
              <span className="rounded-full bg-forest-600 px-3 py-1 text-[11px] font-semibold text-cream">
                Brand profile
              </span>
            </div>
            <div className="mt-3 flex max-w-xs items-center justify-between gap-2">
              <Stat n={String(band.length + rest.length)} label="posts" />
              <Stat n="12.4k" label="followers" />
              <Stat n="284" label="following" />
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Fine jewellery, handcrafted.</span>{' '}
          ✦ Bridal & statement edits. New collection live now.
        </p>
      </div>

      <div className="border-t border-forest-100 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <div className="mb-2 mt-3 flex items-center gap-3 px-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-forest-400">The feed</span>
          <span className="h-px flex-1 bg-forest-100" />
          <GridSizeToggle size={size} onChange={changeSize} />
        </div>

        {/* ONE continuous 3-column grid so it reads as a real profile. The week
            band is pinned to the top and ringed; everything already in the feed
            sits below it for context, newest first. Section labels are
            col-span-3 rows inside the same grid rather than separate grids, so
            the columns never break alignment. */}
        <div className={size === 'mobile' ? 'mx-auto max-w-[24rem]' : ''}>
          <div className={`grid grid-cols-3 ${size === 'mobile' ? 'gap-1' : 'gap-2 sm:gap-3'}`}>
            <WeekBandHeader week={week} />

            {band.map((item) => (
              <FeedTile key={item.id} item={item} highlight onOpen={() => onOpenItem(item)} />
            ))}

            {band.length === 0 ? (
              <p className="col-span-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-6 text-center text-sm text-forest-500 dark:border-brand-500/25 dark:bg-brand-500/5 dark:text-neutral-400">
                Nothing planned for <span className="font-semibold">{week.label}</span> yet.
              </p>
            ) : null}

            <NotShownNote week={week} />

            {rest.length ? (
              <div className="col-span-3 flex items-center gap-3 px-1 pb-1 pt-3">
                {/* Not "Already in the feed": this section holds everything
                    outside the selected week — including future posts that
                    haven't gone up yet — so that label was simply untrue. */}
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-forest-400 dark:text-neutral-500">
                  Rest of the feed
                </span>
                <span className="h-px flex-1 bg-forest-100 dark:bg-white/10" />
              </div>
            ) : null}

            {rest.map((item) => (
              <FeedTile key={item.id} item={item} onOpen={() => onOpenItem(item)} />
            ))}

            {band.length === 0 && rest.length === 0 ? (
              <p className="col-span-3 px-3 py-10 text-center text-sm text-forest-400">No feed posts yet.</p>
            ) : null}

            {hiddenNoMedia ? (
              <p className="col-span-3 px-1 pt-2 text-[11px] text-forest-400 dark:text-neutral-500">
                {hiddenNoMedia} {hiddenNoMedia === 1 ? 'item has' : 'items have'} no media attached and can’t appear on
                a grid.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────── Instagram-style post popup ───────────────────────────
function PostModal({ item, brand, onClose }: { item: ContentItem; brand: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const vid = firstVideo(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  const m = metaFor(item)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
      >
        <IconClose />
      </button>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* media */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
          {item.media.length > 1 ? (
            <Carousel
              count={item.media.length}
              className="w-full"
              ariaLabel="Post media"
              renderSlide={(i, active) => {
                const m = item.media[i]
                return (
                  <div className="flex h-[52vh] items-center justify-center sm:h-[86vh]">
                    {isVid(m) ? (
                      <CarouselVideo
                        src={m.url}
                        poster={m.url.replace(VID_RE, '.poster.jpg')}
                        active={active}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <img src={m.url} alt="" className="max-h-full max-w-full object-contain" />
                    )}
                  </div>
                )
              }}
            />
          ) : vid ? (
            <video src={vid.url} controls autoPlay playsInline className="max-h-[52vh] w-full object-contain sm:max-h-[92vh]" />
          ) : firstImage(item) ? (
            <img src={firstImage(item)!.url} alt={item.title ?? ''} className="max-h-[52vh] w-full object-contain sm:max-h-[92vh]" />
          ) : (
            <div className="grid h-40 w-full place-items-center text-sm text-white/60">No media</div>
          )}
        </div>

        {/* side panel — username, caption, download */}
        <div className="flex w-full flex-col sm:w-80">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-forest-700 font-serif text-sm text-cream">
              {brand.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">{brand}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {weekdayLong(item.date)}, {monthShort(item.date)} {dayNum(item.date)}
              </p>
            </div>
            {item.media.length > 0 ? (
              <button
                type="button"
                onClick={() => downloadMedia(item.media)}
                title="Download"
                aria-label="Download media"
                className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <IconDownload />
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {item.title ? <p className="text-sm font-bold text-forest-800">{item.title}</p> : null}
            {item.caption ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-forest-600">{item.caption}</p>
            ) : (
              <p className="mt-2 text-sm italic text-forest-400">No caption.</p>
            )}
            <div className="mt-4 flex items-center gap-2">
              <TypeTag label={m.label} glyph={m.glyph} />
              <StatusChip item={item} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────── dev-only payload meter ───────────────────────
/**
 * Step 1 deliberately leaves reels at preload="auto" so we can feel what a
 * cumulative grid actually costs before optimising it. This logs that cost —
 * video elements mounted, media requests, and bytes transferred — so there is a
 * hard number to compare against once thumbnails land.
 *
 * Dev-only; the body is dead code in a production build.
 */
function useGridPayloadMeter(tileCount: number) {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof PerformanceObserver === 'undefined') return
    const MEDIA_RE = /\/(media|photos)\//
    let timer = 0
    const report = () => {
      const media = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter((e) =>
        MEDIA_RE.test(e.name),
      )
      // transferSize is exact here because /media is same-origin.
      const bytes = media.reduce((n, e) => n + (e.transferSize || e.encodedBodySize || 0), 0)
      const videos = document.querySelectorAll('video').length
      console.info(
        `[grid payload] tiles=${tileCount} · videoEls=${videos} · mediaRequests=${media.length} · ${(
          bytes / 1048576
        ).toFixed(1)} MB transferred`,
      )
    }
    // Media streams in lazily, so accumulate and report once it settles.
    const obs = new PerformanceObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(report, 800)
    })
    obs.observe({ type: 'resource', buffered: true })
    return () => {
      obs.disconnect()
      window.clearTimeout(timer)
    }
  }, [tileCount])
}

// ─────────────────────────── page ───────────────────────────
export default function GridView() {
  const { data } = useAllContent()
  const all = data ?? []
  const brand = useActiveWorkspaceName() ?? 'chheda jewellers'

  const [openItem, setOpenItem] = useState<ContentItem | null>(null)
  const [params, setParams] = useSearchParams()

  // Which week is highlighted, as ?week=YYYY-MM-DD (a Monday) so a given week
  // can be linked and survives a refresh. A query param rather than a path
  // param keeps /grid a single route and leaves AppShell's active-nav check
  // (pathname === '/grid') intact.
  const weekParam = params.get('week') ?? undefined
  const defaultMonday = useMemo(() => mondayOf(addDays(new Date(), 7)), [])
  const monday = isValidISODate(weekParam) ? mondayOf(parseISODate(weekParam)) : defaultMonday
  const weekStart = toISODate(monday)
  const weekEnd = toISODate(addDays(monday, 6))
  const isDefaultWeek = weekStart === toISODate(defaultMonday)

  const goWeek = (m: Date) => {
    const next = new URLSearchParams(params)
    if (toISODate(m) === toISODate(defaultMonday)) next.delete('week')
    else next.set('week', toISODate(m))
    setParams(next)
  }

  const { band, rest, notShown, nonFeedCount, hiddenNoMedia } = useMemo(() => {
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd

    // Only posts/reels reach a profile grid, and only if they have something to
    // show — a media-less item would render as a blank tile, and in a
    // cumulative view they would cluster at the very top. Excluded outright and
    // counted instead, never silently dropped.
    const feedType = all.filter(isFeedType)
    const renderable = feedType.filter(hasMedia)

    // The band is status-filtered; the feed below it is NOT. Anything the
    // allowlist rejects still appears in context, just not as planned content.
    const bandItems = renderable.filter((i) => inWeek(i.date) && PLANNED_STATUSES.has(i.status)).sort(byDateDesc)
    const bandIds = new Set(bandItems.map((i) => i.id))
    const restItems = renderable.filter((i) => !bandIds.has(i.id)).sort(byDateDesc)

    // Why a week item missed the band — missing media first, then status.
    const reasons = new Map<string, number>()
    for (const it of feedType.filter((i) => inWeek(i.date))) {
      const key = !hasMedia(it)
        ? 'no media'
        : !PLANNED_STATUSES.has(it.status)
          ? statusMeta(it.status).label.toLowerCase()
          : null
      if (key) reasons.set(key, (reasons.get(key) ?? 0) + 1)
    }

    return {
      band: bandItems,
      rest: restItems,
      notShown: reasons.size ? [...reasons].map(([k, n]) => `${n} ${k}`).join(' · ') : null,
      nonFeedCount: all.filter((i) => !isFeedType(i) && inWeek(i.date)).length,
      hiddenNoMedia: feedType.length - renderable.length,
    }
  }, [all, weekStart, weekEnd])

  useGridPayloadMeter(band.length + rest.length)

  const week: WeekBand = {
    label: formatWeekRange(monday),
    items: band,
    notShown,
    nonFeedCount,
    isDefault: isDefaultWeek,
    onPrev: () => goWeek(addDays(monday, -7)),
    onNext: () => goWeek(addDays(monday, 7)),
    onReset: () => goWeek(defaultMonday),
  }

  return (
    <div className="space-y-7">
      <EditorialHeader brand={brand} />

      <ProfilePreview
        brand={brand}
        band={band}
        rest={rest}
        week={week}
        hiddenNoMedia={hiddenNoMedia}
        onOpenItem={setOpenItem}
      />

      {openItem ? <PostModal item={openItem} brand={brand} onClose={() => setOpenItem(null)} /> : null}
    </div>
  )
}
