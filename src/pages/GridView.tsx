import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGridItems } from '../hooks/useAdminData'
import { useDayItems } from '../hooks/useDayData'
import { STATUS_META } from '../lib/contentMeta'
import { REVIEW_DATES } from '../lib/demoData'
import { parseISODate } from '../lib/dates'
import type { ContentItem, MediaItem } from '../types/database'

// ─────────────────────────── media helpers ───────────────────────────
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
const VID_RE = /\.(mp4|webm|mov|m4v)$/i

function isImg(m: MediaItem) {
  return IMG_RE.test(m.name) || IMG_RE.test(m.url)
}
function isVid(m: MediaItem) {
  return VID_RE.test(m.name) || VID_RE.test(m.url)
}
function firstImage(item: ContentItem): MediaItem | null {
  return item.media.find(isImg) ?? null
}
function firstVideo(item: ContentItem): MediaItem | null {
  return item.media.find(isVid) ?? null
}

const monthShort = (iso: string) =>
  parseISODate(iso).toLocaleDateString('en-US', { month: 'short' })
const weekdayLong = (iso: string) =>
  parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long' })
const dayNum = (iso: string) => parseISODate(iso).getDate()

/** Full-colour editorial photo with a subtle hover lift. */
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
 * Chrome's autoplay policy ignores — so we set the muted *property* via a ref
 * and start playback once a frame decodes. A sibling poster frame
 * (`<name>.poster.jpg`) guarantees a visible frame before autoplay (and is how
 * Instagram shows reels in the grid).
 */
function VideoThumb({ src, className = '' }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const poster = src.replace(VID_RE, '.poster.jpg')
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    const tryPlay = () => v.play().catch(() => {})
    if (v.readyState >= 2) tryPlay()
    else v.addEventListener('loadeddata', tryPlay, { once: true })
    return () => v.removeEventListener('loadeddata', tryPlay)
  }, [src])
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

// ─────────────────────────── small chrome ───────────────────────────
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

/** Type label pill (green, on white surfaces). */
function TypeTag({ label, glyph }: { label: string; glyph?: () => JSX.Element }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
      {glyph ? glyph() : null}
      {label}
    </span>
  )
}

function StatusChip({ item }: { item: ContentItem }) {
  const meta = STATUS_META[item.status]
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

// ─────────────────────────── editorial header ───────────────────────────
function EditorialHeader() {
  return (
    <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-forest-700 px-7 py-11 text-cream sm:px-12 sm:py-16">
      {/* oversized serif watermark, ZYRA-style */}
      <span className="pointer-events-none absolute -right-2 -top-14 select-none font-serif text-[13rem] font-bold leading-none text-forest-600/55 sm:-top-20 sm:text-[20rem]">
        G
      </span>
      {/* champagne hairline frame */}
      <span className="pointer-events-none absolute inset-3 rounded-[1.4rem] ring-1 ring-champagne/25 sm:inset-4" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-champagne">
          Chheda&rsquo;s × Apar · Feed Preview
        </p>
        <h1 className="mt-4 font-serif text-5xl font-bold tracking-tight text-cream sm:text-6xl">
          Grid Review
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-forest-100/85">
          A maintained look at how the profile comes together — every post, reel
          and story, planned day by day.
        </p>
      </div>
    </header>
  )
}

// ─────────────────────────── profile + feed ───────────────────────────
function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-xl font-bold text-forest-800">{n}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-forest-400">{label}</div>
    </div>
  )
}

function StoryCircle({ item }: { item: ContentItem }) {
  const img = firstImage(item)
  return (
    <div className="group flex w-16 flex-none flex-col items-center gap-1.5">
      <div className="rounded-full bg-gradient-to-tr from-champagne via-forest-300 to-forest-600 p-[2px]">
        <div className="overflow-hidden rounded-full bg-white p-[2px]">
          <div className="h-14 w-14 overflow-hidden rounded-full">
            {img ? <Photo src={img.url} /> : <div className="h-full w-full bg-forest-100" />}
          </div>
        </div>
      </div>
      <span className="w-full truncate text-center text-[10px] font-medium text-forest-500">
        {item.title || 'Story'}
      </span>
    </div>
  )
}

function FeedTile({ item, index }: { item: ContentItem; index: number }) {
  const vid = firstVideo(item)
  const img = firstImage(item)
  const m = metaFor(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-forest-100 ring-1 ring-forest-100">
      {vid ? <VideoThumb src={vid.url} /> : img ? <Photo src={img.url} /> : null}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-900/70 via-transparent to-transparent" />

      {/* top-left index */}
      <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/85 font-serif text-xs font-bold text-forest-700">
        {index + 1}
      </span>
      {/* top-right type glyph */}
      {item.type === 'reel' || isCarousel ? (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-forest-900/55 text-cream backdrop-blur-sm">
          {item.type === 'reel' ? reelGlyph() : carouselGlyph()}
        </span>
      ) : null}
      {/* bottom caption */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-semibold text-cream">{item.title}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-cream/70">{m.label}</p>
        </div>
      </div>
    </div>
  )
}

function ProfilePreview({
  feed,
  stories,
}: {
  feed: ContentItem[]
  stories: ContentItem[]
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-[0_18px_40px_-28px_rgba(13,27,21,0.45)]">
      <div className="p-6 sm:p-8">
        {/* profile header */}
        <div className="flex flex-wrap items-center gap-5">
          <div className="rounded-full bg-gradient-to-tr from-champagne to-forest-600 p-[3px]">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-forest-700 font-serif text-3xl text-cream sm:h-24 sm:w-24 sm:text-4xl">
              C
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-serif text-2xl font-bold text-forest-800">chhedas.apar</h2>
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
        <p className="mt-4 max-w-md text-sm leading-relaxed text-forest-700">
          <span className="font-semibold text-forest-800">Fine jewellery, handcrafted.</span>{' '}
          ✦ Bridal & statement edits. New collection live now.
        </p>

        {/* story highlights tray */}
        {stories.length ? (
          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
            {stories.map((s) => (
              <StoryCircle key={s.id} item={s} />
            ))}
          </div>
        ) : null}
      </div>

      {/* the feed grid */}
      <div className="border-t border-forest-100 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <div className="mb-2 mt-3 flex items-center gap-3 px-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-forest-400">The feed</span>
          <span className="h-px flex-1 bg-forest-100" />
        </div>
        {feed.length ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {feed.map((item, i) => (
              <FeedTile key={item.id} item={item} index={i} />
            ))}
          </div>
        ) : (
          <p className="px-3 py-10 text-center text-sm text-forest-400">No feed posts yet.</p>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────── per-day plan ───────────────────────────
/** Big media card for a post / reel / carousel inside a day. */
function FeedItemCard({ item }: { item: ContentItem }) {
  const vid = firstVideo(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  const m = metaFor(item)

  return (
    <article className="group overflow-hidden rounded-2xl border border-forest-100 bg-white">
      <div className="relative">
        {isCarousel ? (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {item.media.map((media, i) => (
              <div key={media.path} className="group/slide relative aspect-[4/5] overflow-hidden">
                <Photo src={media.url} />
                <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-forest-900/65 px-1.5 py-0.5 text-[9px] font-bold text-cream backdrop-blur-sm">
                  {i + 1}/{item.media.length}
                </span>
              </div>
            ))}
          </div>
        ) : vid ? (
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[15rem] overflow-hidden sm:max-w-[19rem]">
            <VideoThumb src={vid.url} />
          </div>
        ) : (
          <div className="relative aspect-[4/5] overflow-hidden">
            {firstImage(item) ? <Photo src={firstImage(item)!.url} /> : null}
          </div>
        )}
        <span className="absolute left-3 top-3">
          <TypeTag label={m.label} glyph={m.glyph} />
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-serif text-lg font-semibold text-forest-800">
            {item.title || '(untitled)'}
          </h4>
          <StatusChip item={item} />
        </div>
        {item.caption ? (
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-forest-600 line-clamp-3">
            {item.caption}
          </p>
        ) : null}
        {isCarousel ? (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-400">
            Carousel · {item.media.length} slides in one post
          </p>
        ) : null}
      </div>
    </article>
  )
}

/** Vertical 9:16 story card. */
function StoryCard({ item }: { item: ContentItem }) {
  const img = firstImage(item)
  return (
    <div className="group w-32 flex-none sm:w-36">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-forest-100 ring-1 ring-champagne/40">
        {img ? <Photo src={img.url} /> : null}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-900/65 via-transparent to-forest-900/10" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-forest-900/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cream backdrop-blur-sm">
          Story
        </span>
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="truncate font-serif text-sm font-semibold text-cream">{item.title}</p>
          <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${STATUS_META[item.status].chip}`}>
            {STATUS_META[item.status].label}
          </span>
        </div>
      </div>
    </div>
  )
}

function summarize(items: ContentItem[]): string {
  const posts = items.filter((i) => i.type === 'post' && i.media.length <= 1).length
  const carousels = items.filter((i) => i.type === 'post' && i.media.length > 1).length
  const reels = items.filter((i) => i.type === 'reel').length
  const stories = items.filter((i) => i.type === 'story').length
  const parts: string[] = []
  if (posts) parts.push(`${posts} Post${posts > 1 ? 's' : ''}`)
  if (carousels) parts.push(`${carousels} Carousel${carousels > 1 ? 's' : ''}`)
  if (reels) parts.push(`${reels} Reel${reels > 1 ? 's' : ''}`)
  if (stories) parts.push(`${stories} Stor${stories > 1 ? 'ies' : 'y'}`)
  return parts.join(' · ')
}

function DayPlan({ dateISO, index }: { dateISO: string; index: number }) {
  const { data, isLoading } = useDayItems(dateISO)
  const items = data ?? []
  const feed = items.filter((i) => i.type === 'post' || i.type === 'reel')
  const stories = items.filter((i) => i.type === 'story')

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-[0_18px_40px_-30px_rgba(13,27,21,0.4)]">
      {/* dated green band */}
      <div className="relative isolate flex items-center gap-5 overflow-hidden bg-forest-700 px-6 py-7 text-cream sm:px-9">
        <span className="pointer-events-none absolute -right-3 -top-8 select-none font-serif text-[9rem] font-bold leading-none text-forest-600/55">
          {String(index + 1)}
        </span>
        <div className="relative grid flex-none place-items-center">
          <span className="font-serif text-6xl font-bold leading-none text-cream sm:text-7xl">
            {dayNum(dateISO)}
          </span>
        </div>
        <div className="relative min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-champagne">
            Day {index + 1}
          </p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-cream sm:text-3xl">
            {weekdayLong(dateISO)}, {monthShort(dateISO)} {dayNum(dateISO)}
          </h3>
          <p className="mt-1 text-sm font-medium text-forest-100/85">{summarize(items)}</p>
        </div>
      </div>

      {/* body */}
      <div className="space-y-7 p-6 sm:p-8">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-forest-400">Loading…</p>
        ) : (
          <>
            {feed.length ? (
              <div>
                <h4 className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-forest-400">
                  Feed
                  <span className="h-px flex-1 bg-forest-100" />
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {feed.map((item) => {
                    const wide = item.type === 'post' && item.media.length > 1
                    return (
                      <div key={item.id} className={wide ? 'sm:col-span-2' : ''}>
                        <FeedItemCard item={item} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {stories.length ? (
              <div>
                <h4 className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-forest-400">
                  Stories
                  <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] text-forest-500">
                    {stories.length}
                  </span>
                  <span className="h-px flex-1 bg-forest-100" />
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {stories.map((s) => (
                    <StoryCard key={s.id} item={s} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────── page ───────────────────────────
export default function GridView() {
  const { data: gridData } = useGridItems()
  const day1 = useDayItems(REVIEW_DATES[0])
  const day2 = useDayItems(REVIEW_DATES[1])

  const feed = gridData ?? []
  const stories = [...(day1.data ?? []), ...(day2.data ?? [])].filter((i) => i.type === 'story')

  return (
    <div className="space-y-7">
      <EditorialHeader />

      <ProfilePreview feed={feed} stories={stories} />

      {/* the plan */}
      <div className="mt-2 flex items-center gap-4 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-forest-400">The plan</p>
          <h2 className="font-serif text-2xl font-bold text-forest-800">Two days, in detail</h2>
        </div>
        <span className="mt-3 h-px flex-1 bg-forest-100" />
      </div>

      <div className="space-y-7">
        {REVIEW_DATES.map((d, i) => (
          <DayPlan key={d} dateISO={d} index={i} />
        ))}
      </div>

      <p className="px-1 pb-2 text-center text-xs text-forest-400">
        Sample plan — seeded demo content from <code className="font-mono">/public/photos</code>.{' '}
        <Link to="/day/2026-07-02" className="font-semibold text-forest-600 underline-offset-2 hover:underline">
          Open July 2
        </Link>{' '}
        to edit the real day.
      </p>
    </div>
  )
}
