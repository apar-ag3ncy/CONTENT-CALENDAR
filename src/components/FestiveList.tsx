// Renders festive content items grouped by type (Posts / Reels / Stories /
// Captions), each tagged with its festival name. Used on the day page (that
// day's festive items) and the month Festive view (the whole month's).
import type { ContentItem, ContentType, MediaItem } from '../types/database'
import { parseISODate } from '../lib/dates'

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
const VID_RE = /\.(mp4|webm|mov|m4v)$/i
const isImg = (m: MediaItem) => IMG_RE.test(m.name) || IMG_RE.test(m.url)
const isVid = (m: MediaItem) => VID_RE.test(m.name) || VID_RE.test(m.url)
const firstImage = (item: ContentItem) => item.media.find(isImg) ?? null
const firstVideo = (item: ContentItem) => item.media.find(isVid) ?? null

const TYPE_ORDER: ContentType[] = ['post', 'reel', 'story', 'caption']
const TYPE_LABEL: Record<ContentType, string> = {
  post: 'Posts',
  reel: 'Reels',
  story: 'Stories',
  caption: 'Captions',
}

const shortDate = (iso: string) =>
  parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Thumb({ item }: { item: ContentItem }) {
  const vid = firstVideo(item)
  const img = firstImage(item)
  const src = img?.url ?? (vid ? vid.url.replace(VID_RE, '.poster.jpg') : null)
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5">
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-2xl">🎉</div>
      )}
      {item.type === 'reel' ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          ▶ Reel
        </span>
      ) : null}
    </div>
  )
}

function FestiveCard({ item, showDate, onOpen }: { item: ContentItem; showDate: boolean; onOpen?: (item: ContentItem) => void }) {
  const clickable = Boolean(onOpen)
  const body = (
    <>
      <Thumb item={item} />
      <div className="mt-1.5">
        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-flame-100 px-2 py-0.5 text-[10px] font-bold text-flame-700 dark:bg-flame-500/15 dark:text-flame-300">
          🎉 {item.festival_name || 'Festive'}
        </span>
        <p className="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
          {item.title || '(untitled)'}
        </p>
        {showDate ? <p className="text-[11px] text-slate-400">{shortDate(item.date)}</p> : null}
      </div>
    </>
  )
  return clickable ? (
    <button type="button" onClick={() => onOpen?.(item)} className="group block w-full text-left">
      {body}
    </button>
  ) : (
    <div className="w-full">{body}</div>
  )
}

/** Groups festive items by type and lays each group out as a small grid. */
export function FestiveList({
  items,
  onOpen,
  showDate = false,
}: {
  items: ContentItem[]
  onOpen?: (item: ContentItem) => void
  showDate?: boolean
}) {
  const groups = TYPE_ORDER.map((t) => ({ type: t, list: items.filter((i) => i.type === t) })).filter(
    (g) => g.list.length > 0,
  )
  if (groups.length === 0) return null

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.type}>
          <h4 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {TYPE_LABEL[g.type]}
            <span className="rounded-full bg-flame-100 px-2 py-0.5 text-[10px] text-flame-700 dark:bg-flame-500/15 dark:text-flame-300">
              {g.list.length}
            </span>
            <span className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
          </h4>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {g.list.map((item) => (
              <FestiveCard key={item.id} item={item} showDate={showDate} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
