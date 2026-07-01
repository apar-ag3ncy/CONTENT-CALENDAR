import { useEffect, useMemo, useState } from 'react'
import { useAllContent } from '../hooks/useAdminData'
import { statusMeta } from '../lib/contentMeta'
import { parseISODate } from '../lib/dates'
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
          The whole feed at a glance — every planned post, newest first.
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

/** Clean Instagram grid tile — image/reel only, click to open. No text overlay. */
function FeedTile({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  const vid = firstVideo(item)
  const img = firstImage(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-forest-100 ring-1 ring-forest-100"
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

function ProfilePreview({
  brand,
  feed,
  onOpenItem,
}: {
  brand: string
  feed: ContentItem[]
  onOpenItem: (item: ContentItem) => void
}) {
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
              <Stat n={String(feed.length)} label="posts" />
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
        </div>
        {feed.length ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {feed.map((item) => (
              <FeedTile key={item.id} item={item} onOpen={() => onOpenItem(item)} />
            ))}
          </div>
        ) : (
          <p className="px-3 py-10 text-center text-sm text-forest-400">No feed posts yet.</p>
        )}
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

// ─────────────────────────── page ───────────────────────────
export default function GridView() {
  const { data } = useAllContent()
  const all = data ?? []
  const brand = useActiveWorkspaceName() ?? 'chheda jewellers'

  const [openItem, setOpenItem] = useState<ContentItem | null>(null)

  // The Instagram-style feed grid only — same view for the Apar team and clients
  // (no stories, no per-day breakdown).
  const feed = useMemo(() => all.filter((i) => i.type === 'post' || i.type === 'reel').sort(byDateDesc), [all])

  return (
    <div className="space-y-7">
      <EditorialHeader brand={brand} />

      <ProfilePreview brand={brand} feed={feed} onOpenItem={setOpenItem} />

      {openItem ? <PostModal item={openItem} brand={brand} onClose={() => setOpenItem(null)} /> : null}
    </div>
  )
}
