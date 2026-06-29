import { useEffect, useMemo, useState } from 'react'
import { useAllContent } from '../hooks/useAdminData'
import { STATUS_META } from '../lib/contentMeta'
import { parseISODate } from '../lib/dates'
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

// ─────────────────────────── ordering ───────────────────────────
/** date DESC, then newest-created first — the Instagram "newest at top" feed. */
function byDateDesc(a: ContentItem, b: ContentItem): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1
}
/** date ASC, oldest first — stories play month-start → month-end. */
function byDateAsc(a: ContentItem, b: ContentItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
}
/** Group every item by date, newest day first. */
function groupDaysDesc(all: ContentItem[]): [string, ContentItem[]][] {
  const map = new Map<string, ContentItem[]>()
  for (const it of all) {
    const arr = map.get(it.date)
    if (arr) arr.push(it)
    else map.set(it.date, [it])
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

// ─────────────────────────── editorial header ───────────────────────────
function EditorialHeader() {
  return (
    <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-forest-700 px-7 py-11 text-cream sm:px-12 sm:py-16">
      <span className="pointer-events-none absolute -right-2 -top-14 select-none font-serif text-[13rem] font-bold leading-none text-forest-600/55 sm:-top-20 sm:text-[20rem]">
        G
      </span>
      <span className="pointer-events-none absolute inset-3 rounded-[1.4rem] ring-1 ring-champagne/25 sm:inset-4" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-champagne">
          Chheda&rsquo;s × Apar · Feed Preview
        </p>
        <h1 className="mt-4 font-serif text-5xl font-bold tracking-tight text-cream sm:text-6xl">
          Grid Review
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-forest-100/85">
          The whole feed at a glance — newest day on top, then every day below it.
          Tap the profile photo to watch the stories.
        </p>
      </div>
    </header>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-xl font-bold text-forest-800">{n}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-forest-400">{label}</div>
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
  feed,
  storyCount,
  onOpenStories,
  onOpenItem,
}: {
  feed: ContentItem[]
  storyCount: number
  onOpenStories: () => void
  onOpenItem: (item: ContentItem) => void
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-[0_18px_40px_-28px_rgba(13,27,21,0.45)]">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          {/* profile photo → stories */}
          <button
            type="button"
            onClick={storyCount ? onOpenStories : undefined}
            title={storyCount ? 'Watch stories' : undefined}
            className={`relative rounded-full p-[3px] transition ${
              storyCount
                ? 'cursor-pointer bg-gradient-to-tr from-champagne via-flame-400 to-brand-600 hover:scale-[1.02]'
                : 'cursor-default bg-gradient-to-tr from-champagne to-forest-600'
            }`}
          >
            <div className="rounded-full bg-white p-[3px]">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-forest-700 font-serif text-3xl text-cream sm:h-24 sm:w-24 sm:text-4xl">
                C
              </div>
            </div>
            {storyCount ? (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-flame-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                ▶ {storyCount}
              </span>
            ) : null}
          </button>

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
            {storyCount ? (
              <button
                type="button"
                onClick={onOpenStories}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-flame-600 hover:underline"
              >
                ▶ Watch {storyCount} {storyCount === 1 ? 'story' : 'stories'}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-forest-700">
          <span className="font-semibold text-forest-800">Fine jewellery, handcrafted.</span>{' '}
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
function PostModal({ item, onClose }: { item: ContentItem; onClose: () => void }) {
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
          {vid ? (
            <video src={vid.url} controls autoPlay playsInline className="max-h-[52vh] w-full object-contain sm:max-h-[92vh]" />
          ) : isCarousel ? (
            <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto">
              {item.media.map((media) => (
                <img key={media.path} src={media.url} alt="" className="max-h-[52vh] w-full flex-none snap-center object-contain sm:max-h-[92vh]" />
              ))}
            </div>
          ) : firstImage(item) ? (
            <img src={firstImage(item)!.url} alt={item.title ?? ''} className="max-h-[52vh] w-full object-contain sm:max-h-[92vh]" />
          ) : (
            <div className="grid h-40 w-full place-items-center text-sm text-white/60">No media</div>
          )}
        </div>

        {/* side panel — username, caption, download */}
        <div className="flex w-full flex-col sm:w-80">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-forest-700 font-serif text-sm text-cream">C</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-forest-800">chhedas.apar</p>
              <p className="text-[11px] text-forest-400">
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

// ─────────────────────────── Instagram-style stories viewer ───────────────────────────
function StoriesViewer({ stories, onClose }: { stories: ContentItem[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const cur = stories[idx]

  const go = (delta: number) =>
    setIdx((i) => Math.min(Math.max(i + delta, 0), stories.length - 1))

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
  }, [onClose, stories.length])

  // Auto-advance; close after the last story.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (idx + 1 < stories.length) setIdx(idx + 1)
      else onClose()
    }, 5000)
    return () => window.clearTimeout(t)
  }, [idx, stories.length, onClose])

  if (!cur) return null
  const vid = firstVideo(cur)
  const img = firstImage(cur)

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 p-3">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
      >
        <IconClose />
      </button>

      {/* 9:16 story frame */}
      <div className="relative aspect-[9/16] max-h-[88vh] w-auto max-w-[94vw] overflow-hidden rounded-2xl bg-forest-900 shadow-2xl">
        {/* pagination bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
          {stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className={`block h-full rounded-full bg-white transition-all ${i < idx ? 'w-full' : i === idx ? 'w-full animate-[pulse_2s_ease-in-out_infinite]' : 'w-0'}`} />
            </span>
          ))}
        </div>

        {/* header */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pb-2 pt-6 text-white">
          <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-forest-700 font-serif text-xs text-cream ring-2 ring-white/70">C</div>
          <span className="text-sm font-semibold">chhedas.apar</span>
          <span className="text-[11px] text-white/70">· {monthShort(cur.date)} {dayNum(cur.date)}</span>
          <span className="ml-auto text-[11px] text-white/60">{idx + 1}/{stories.length}</span>
        </div>

        {/* media */}
        {vid ? (
          <video key={cur.id} src={vid.url} autoPlay playsInline muted loop className="h-full w-full object-cover" />
        ) : img ? (
          <img key={cur.id} src={img.url} alt={cur.title ?? ''} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-white/60">No media</div>
        )}

        {/* gradient + caption */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white">
          {cur.title ? <p className="font-serif text-lg font-semibold drop-shadow">{cur.title}</p> : null}
          {cur.caption ? <p className="mt-1 text-sm text-white/85 drop-shadow line-clamp-2">{cur.caption}</p> : null}
        </div>

        {/* tap zones */}
        <button type="button" aria-label="Previous" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default focus:outline-none" />
        <button type="button" aria-label="Next" onClick={() => go(1)} className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-default focus:outline-none" />
      </div>

      {/* download current */}
      {cur.media.length > 0 ? (
        <button
          type="button"
          onClick={() => downloadMedia(cur.media)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
        >
          <IconDownload /> Download story
        </button>
      ) : null}
    </div>
  )
}

// ─────────────────────────── per-day overview ───────────────────────────
function FeedItemCard({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  const vid = firstVideo(item)
  const isCarousel = item.type === 'post' && item.media.length > 1
  const m = metaFor(item)

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-forest-100 bg-white">
      {item.media.length > 0 ? (
        <button
          type="button"
          onClick={() => downloadMedia(item.media)}
          title="Download media"
          aria-label="Download media"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-forest-700 shadow ring-1 ring-forest-100 transition hover:bg-white hover:text-brand-700"
        >
          <IconDownload />
        </button>
      ) : null}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          {isCarousel ? (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {item.media.map((media, i) => (
                <div key={media.path} className="relative aspect-[4/5] overflow-hidden">
                  <Photo src={media.url} />
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
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-serif text-lg font-semibold text-forest-800">{item.title || '(untitled)'}</h4>
          <StatusChip item={item} />
        </div>
        {item.caption ? (
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-forest-600 line-clamp-3">{item.caption}</p>
        ) : null}
      </div>
    </article>
  )
}

function StoryCard({ item }: { item: ContentItem }) {
  const img = firstImage(item)
  const vid = firstVideo(item)
  return (
    <div className="group relative w-32 flex-none sm:w-36">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-forest-100 ring-1 ring-champagne/40">
        {vid ? <VideoThumb src={vid.url} /> : img ? <Photo src={img.url} /> : null}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-900/65 via-transparent to-forest-900/10" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-forest-900/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cream backdrop-blur-sm">
          Story
        </span>
        {item.media.length > 0 ? (
          <button
            type="button"
            onClick={() => downloadMedia(item.media)}
            title="Download"
            aria-label="Download story"
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/85 text-forest-700 shadow transition hover:bg-white hover:text-brand-700"
          >
            <IconDownload />
          </button>
        ) : null}
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
  return parts.join(' · ') || 'Nothing yet'
}

function DayOverview({
  dateISO,
  items,
  onOpenItem,
}: {
  dateISO: string
  items: ContentItem[]
  onOpenItem: (item: ContentItem) => void
}) {
  const feed = items.filter((i) => i.type === 'post' || i.type === 'reel').sort(byDateDesc)
  const stories = items.filter((i) => i.type === 'story')
  const captions = items.filter((i) => i.type === 'caption')

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-forest-100 bg-white shadow-[0_18px_40px_-30px_rgba(13,27,21,0.4)]">
      <div className="relative isolate flex items-center gap-5 overflow-hidden bg-forest-700 px-6 py-7 text-cream sm:px-9">
        <span className="pointer-events-none absolute -right-3 -top-8 select-none font-serif text-[9rem] font-bold leading-none text-forest-600/55">
          {dayNum(dateISO)}
        </span>
        <div className="relative grid flex-none place-items-center">
          <span className="font-serif text-6xl font-bold leading-none text-cream sm:text-7xl">{dayNum(dateISO)}</span>
        </div>
        <div className="relative min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-champagne">
            {monthShort(dateISO)} {dayNum(dateISO)}
          </p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-cream sm:text-3xl">{weekdayLong(dateISO)}</h3>
          <p className="mt-1 text-sm font-medium text-forest-100/85">{summarize(items)}</p>
        </div>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
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
                    <FeedItemCard item={item} onOpen={() => onOpenItem(item)} />
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
              <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] text-forest-500">{stories.length}</span>
              <span className="h-px flex-1 bg-forest-100" />
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stories.map((s) => (
                <StoryCard key={s.id} item={s} />
              ))}
            </div>
          </div>
        ) : null}

        {captions.length ? (
          <div>
            <h4 className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-forest-400">
              Captions
              <span className="h-px flex-1 bg-forest-100" />
            </h4>
            <div className="space-y-2">
              {captions.map((c) => (
                <div key={c.id} className="rounded-xl border border-forest-100 bg-cream/40 p-3">
                  <p className="text-sm font-semibold text-forest-800">{c.title}</p>
                  {c.caption ? <p className="mt-1 whitespace-pre-wrap text-sm text-forest-600">{c.caption}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

// ─────────────────────────── page ───────────────────────────
export default function GridView() {
  const { data, isLoading } = useAllContent()
  const all = data ?? []

  const [openItem, setOpenItem] = useState<ContentItem | null>(null)
  const [storiesOpen, setStoriesOpen] = useState(false)

  const feed = useMemo(() => all.filter((i) => i.type === 'post' || i.type === 'reel').sort(byDateDesc), [all])
  const stories = useMemo(() => all.filter((i) => i.type === 'story').sort(byDateAsc), [all])
  const days = useMemo(() => groupDaysDesc(all), [all])

  return (
    <div className="space-y-7">
      <EditorialHeader />

      <ProfilePreview
        feed={feed}
        storyCount={stories.length}
        onOpenStories={() => setStoriesOpen(true)}
        onOpenItem={setOpenItem}
      />

      <div className="mt-2 flex items-center gap-4 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-forest-400">The plan</p>
          <h2 className="font-serif text-2xl font-bold text-forest-800">Every day, newest first</h2>
        </div>
        <span className="mt-3 h-px flex-1 bg-forest-100" />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-forest-400">Loading…</p>
      ) : days.length ? (
        <div className="space-y-7">
          {days.map(([date, items]) => (
            <DayOverview key={date} dateISO={date} items={items} onOpenItem={setOpenItem} />
          ))}
        </div>
      ) : (
        <p className="rounded-[1.75rem] border border-dashed border-forest-200 bg-white py-12 text-center text-sm text-forest-400">
          Nothing planned yet. Add posts, reels and stories from any day to see the feed come together.
        </p>
      )}

      {openItem ? <PostModal item={openItem} onClose={() => setOpenItem(null)} /> : null}
      {storiesOpen && stories.length ? <StoriesViewer stories={stories} onClose={() => setStoriesOpen(false)} /> : null}
    </div>
  )
}
