import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGridItems } from '../hooks/useAdminData'
import { useReorderGrid } from '../hooks/useAdminMutations'
import { isFirebaseConfigured } from '../lib/firebase'
import { humanError } from '../lib/errors'
import { STATUS_META } from '../lib/contentMeta'
import { formatMonthShort, parseISODate } from '../lib/dates'
import type { ContentItem, MediaItem } from '../types/database'

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i

function shortDate(iso: string) {
  const d = parseISODate(iso)
  return `${formatMonthShort(d.getFullYear(), d.getMonth())} ${d.getDate()}`
}

/** First media file = the thumbnail; only show it as a background if an image. */
function imageThumb(item: ContentItem): MediaItem | null {
  const m = item.media[0]
  if (!m) return null
  return IMG_RE.test(m.name) || IMG_RE.test(m.url) ? m : null
}

function Tile({
  item,
  index,
  total,
  canEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
}: {
  item: ContentItem
  index: number
  total: number
  canEdit: boolean
  onDragStart: (id: string) => void
  onDragOver: (overId: string) => void
  onDrop: () => void
  onDragEnd: () => void
  onMove: (id: string, delta: number) => void
}) {
  const thumb = imageThumb(item)
  const hasImage = thumb !== null
  const isReel = item.type === 'reel'
  const isCarousel = item.media.length > 1

  return (
    <div
      draggable={canEdit}
      onDragStart={() => onDragStart(item.id)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(item.id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
      className={`group relative flex aspect-square flex-col justify-between overflow-hidden rounded-md bg-gradient-to-br from-brand-100 to-brand-50 p-1.5 sm:p-2 ${
        canEdit ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {hasImage ? (
        <>
          <img
            src={thumb.url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </>
      ) : null}

      <div className="relative z-10 flex items-start justify-between">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white/85 text-[10px] font-bold text-brand-700">
          {index + 1}
        </span>
        <div className="flex items-center gap-1">
          {isReel ? (
            <span
              aria-label="Reel"
              title="Reel"
              className="grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px]"
            >
              🎬
            </span>
          ) : null}
          {isCarousel ? (
            <span
              aria-label="Carousel"
              title="Carousel"
              className="grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px] text-white"
            >
              ⧉
            </span>
          ) : null}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_META[item.status].chip}`}
          >
            {STATUS_META[item.status].label}
          </span>
        </div>
      </div>

      <div className="relative z-10 min-w-0">
        <p
          className={`truncate text-[11px] font-bold sm:text-xs ${
            hasImage ? 'text-white' : 'text-slate-800'
          }`}
        >
          {item.title || '(untitled)'}
        </p>
        <p
          className={`text-[10px] ${hasImage ? 'text-white/85' : 'text-slate-500'}`}
        >
          {shortDate(item.date)}
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between">
        {item.drive_link ? (
          <a
            href={item.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-brand-700 hover:underline"
            title="Open in Drive"
            aria-label="Open in Drive"
          >
            📂
          </a>
        ) : (
          <span />
        )}
        {canEdit ? (
          <span className="flex gap-1">
            <button
              type="button"
              aria-label="Move earlier"
              disabled={index === 0}
              onClick={() => onMove(item.id, -1)}
              className="grid h-7 w-7 place-items-center rounded bg-white/90 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move later"
              disabled={index === total - 1}
              onClick={() => onMove(item.id, 1)}
              className="grid h-7 w-7 place-items-center rounded bg-white/90 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-30"
            >
              ↓
            </button>
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function GridView() {
  const canEdit = isFirebaseConfigured
  const { data, isLoading } = useGridItems()
  const reorder = useReorderGrid()

  const [order, setOrder] = useState<ContentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const draggingId = useRef<string | null>(null)
  const orderRef = useRef<ContentItem[]>([])
  orderRef.current = order
  const inFlightRef = useRef(false)
  const queuedRef = useRef<string[] | null>(null)
  const savedKeyRef = useRef('')

  // Resync local order whenever the server data (ids/positions) changes.
  const serverKey = (data ?? [])
    .map((i) => `${i.id}:${i.grid_position}`)
    .join(',')
  useEffect(() => {
    const fresh = data ?? []
    setOrder(fresh)
    savedKeyRef.current = fresh.map((i) => i.id).join(',')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  function runPersist(ids: string[]) {
    inFlightRef.current = true
    reorder.mutate(ids, {
      onError: (e) => setError(humanError(e)),
      onSettled: () => {
        inFlightRef.current = false
        const queued = queuedRef.current
        if (queued) {
          queuedRef.current = null
          runPersist(queued)
        }
      },
    })
  }

  // Save only the latest order: skip when nothing moved, and serialise
  // overlapping saves so a stale order can't overwrite a newer one.
  function persist(next: ContentItem[]) {
    const ids = next.map((i) => i.id)
    const key = ids.join(',')
    if (key === savedKeyRef.current) return
    savedKeyRef.current = key
    setError(null)
    if (inFlightRef.current) {
      queuedRef.current = ids
      return
    }
    runPersist(ids)
  }

  function reorderTo(fromId: string, toId: string) {
    setOrder((prev) => {
      const from = prev.findIndex((i) => i.id === fromId)
      const to = prev.findIndex((i) => i.id === toId)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function moveBy(id: string, delta: number) {
    const idx = order.findIndex((i) => i.id === id)
    const to = idx + delta
    if (idx < 0 || to < 0 || to >= order.length) return
    const next = [...order]
    const [moved] = next.splice(idx, 1)
    next.splice(to, 0, moved)
    setOrder(next)
    setError(null)
    persist(next)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">
          A feed preview of every Post and Reel. Drag a tile on a computer — or
          tap the ↑ ↓ arrows on any device — to rearrange how the profile will
          look.
        </p>
      </div>

      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Connect Firebase to load and arrange your feed.
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : order.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-slate-500">No posts or reels in the feed yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Open any day and add a{' '}
            <span className="font-semibold">Post</span> or{' '}
            <span className="font-semibold">Reel</span> — it will show up here in
            your feed preview.
          </p>
          <Link to="/" className="btn-ghost mt-4 inline-flex px-4 py-2 text-sm">
            Go to the calendar
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 sm:gap-2 sm:p-2">
            {order.map((item, i) => (
              <Tile
                key={item.id}
                item={item}
                index={i}
                total={order.length}
                canEdit={canEdit}
                onDragStart={(id) => {
                  draggingId.current = id
                  setError(null)
                }}
                onDragOver={(overId) => {
                  const dragId = draggingId.current
                  if (dragId && dragId !== overId) reorderTo(dragId, overId)
                }}
                onDrop={() => {
                  draggingId.current = null
                }}
                onDragEnd={() => {
                  draggingId.current = null
                  // Fires after any drag (even dropping in a gutter), so the
                  // reordered feed is always saved.
                  persist(orderRef.current)
                }}
                onMove={moveBy}
              />
            ))}
          </div>
          {reorder.isPending ? (
            <p className="mt-2 text-center text-xs text-slate-400">
              Saving order…
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
