import { useEffect, useMemo, useState } from 'react'
import {
  WEEKDAY_LONG,
  formatLongDate,
  parseISODate,
  weekdayMonFirst,
} from '../lib/dates'
import {
  CONTENT_TYPE_META,
  CONTENT_TYPE_ORDER,
  POST_FORMAT_META,
  STATUS_META,
  STATUS_ORDER,
  statusMeta,
} from '../lib/contentMeta'
import { ConfirmDialog } from './ConfirmDialog'
import { Reveal } from './Reveal'
import { useDayItems, useDayNote } from '../hooks/useDayData'
import { useCalendarRange } from '../hooks/useCalendarData'
import {
  useUpdateItem,
  useDeleteItem,
  useUpsertDayNote,
} from '../hooks/useMutations'
import { useNavigate } from 'react-router-dom'
import { isApiConfigured } from '../lib/api'
import { humanError } from '../lib/errors'
import type {
  ContentItem,
  ContentStatus,
  ContentType,
  MediaItem,
} from '../types/database'

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i

/** The first media file, if any, is used as an item's thumbnail. */
function thumbOf(item: ContentItem): MediaItem | null {
  return item.media.length > 0 ? item.media[0] : null
}

function isImageThumb(m: MediaItem): boolean {
  return IMG_RE.test(m.name) || IMG_RE.test(m.url)
}

/** Download every media file of an item (same-origin /media files honour `download`). */
function downloadMedia(media: MediaItem[]) {
  media.forEach((m, i) => {
    const a = document.createElement('a')
    a.href = m.url
    a.download = m.name || `media-${i + 1}`
    a.rel = 'noopener'
    document.body.appendChild(a)
    // Stagger so the browser doesn't drop rapid-fire downloads.
    window.setTimeout(() => {
      a.click()
      a.remove()
    }, i * 300)
  })
}

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19.5h14" />
  </svg>
)

const ADD_TYPES: ContentType[] = ['post', 'reel', 'story', 'caption']

function ItemCard({
  item,
  canEdit,
  onEdit,
  onRemove,
  onStatusChange,
}: {
  item: ContentItem
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
  onStatusChange: (item: ContentItem, status: ContentStatus) => void
}) {
  const images = item.media.filter(isImageThumb)
  const videos = item.media.filter((m) => !isImageThumb(m))

  return (
    <div className="relative rounded-2xl border border-slate-200 p-4 sm:p-5">
      {item.media.length > 0 ? (
        <button
          type="button"
          onClick={() => downloadMedia(item.media)}
          title="Download media"
          aria-label="Download media"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-slate-900/5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
        >
          <IconDownload /> Download
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 pr-28">
        <TypeChipInline type={item.type} />
        {item.type === 'post' && item.post_format ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            <span aria-hidden>{POST_FORMAT_META[item.post_format].icon}</span>
            {POST_FORMAT_META[item.post_format].label}
          </span>
        ) : null}
        {item.media_type ? (
          <span className="text-xs font-medium text-slate-500">
            {item.media_type === 'video' ? '🎥 Video' : '📷 Photo'}
          </span>
        ) : null}
        <span className="ml-auto">
          <StatusChipInline status={item.status} />
        </span>
      </div>

      <h4 className="mt-2 font-bold text-slate-900">
        {item.title || '(untitled)'}
      </h4>
      {item.caption ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
          {item.caption}
        </p>
      ) : null}

      {images.length === 1 ? (
        <a
          href={images[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
        >
          <img
            src={images[0].url}
            alt={item.title ?? 'Uploaded media'}
            className="max-h-[30rem] w-full rounded-xl border border-slate-100 object-cover"
          />
        </a>
      ) : images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((m, i) => (
            <a
              key={m.path}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex-none"
            >
              <img
                src={m.url}
                alt=""
                className="h-60 w-60 rounded-xl border border-slate-100 object-cover"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {i + 1}/{images.length}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {videos.map((m) => (
            <a
              key={m.path}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              🎞️ {m.name}
            </a>
          ))}
        </div>
      ) : null}

      {item.notes ? (
        <div className="mt-2 text-xs text-slate-500">
          <span className="italic">“{item.notes}”</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          Status
          <select
            value={item.status}
            disabled={!canEdit}
            onChange={(e) =>
              onStatusChange(item, e.target.value as ContentStatus)
            }
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onEdit(item)}
          disabled={!canEdit}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={!canEdit}
          className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

/** Small inline type chip (mirrors ContentBadges' TypeChip). */
function TypeChipInline({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.chip}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

function StatusChipInline({ status }: { status: ContentStatus }) {
  const meta = statusMeta(status)
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
    >
      {meta.label}
    </span>
  )
}

const IconCalendarPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" />
  </svg>
)

// --- Monoline glyphs for the glass "Add something" cards --------------------
const IconPost = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="M4 16.5l4.2-4a2 2 0 0 1 2.7-.1l3.1 2.8M14 14l1.8-1.7a2 2 0 0 1 2.7 0l1.5 1.4" />
  </svg>
)
const IconReel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
    <path d="M3.5 9h17M8 4.7l2.4 4.3M13.4 4.7l2.4 4.3" />
    <path d="M10.6 12.3v4.4l3.8-2.2z" fill="currentColor" stroke="none" />
  </svg>
)
const IconStory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.4" />
    <path d="M12 7.6V12l3 1.9" />
  </svg>
)
const IconCaption = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <path d="M5 5.5h14a1.6 1.6 0 0 1 1.6 1.6v7.4a1.6 1.6 0 0 1-1.6 1.6h-8.4l-4 3v-3H5A1.6 1.6 0 0 1 3.4 14.5V7.1A1.6 1.6 0 0 1 5 5.5Z" />
    <path d="M7 9.5h10M7 12.5h6" />
  </svg>
)

/** Icon, floating-pill label, and desktop cascade offset keyed by ContentType. */
const ADD_ICONS: Record<ContentType, () => JSX.Element> = {
  post: IconPost,
  reel: IconReel,
  story: IconStory,
  caption: IconCaption,
}
const ADD_PILL: Record<ContentType, string> = {
  post: 'Feed',
  reel: 'Video',
  story: '24h',
  caption: 'Words',
}
const ADD_STAGGER = [
  'lg:translate-y-0',
  'lg:translate-y-3',
  'lg:translate-y-4',
  'lg:translate-y-1',
] as const

export function DayContent({ dateISO }: { dateISO: string }) {
  const d = parseISODate(dateISO)
  const dayOfWeek = WEEKDAY_LONG[weekdayMonFirst(d)]

  // Data
  const dayItemsQ = useDayItems(dateISO)
  const dayNoteQ = useDayNote(dateISO)
  const { specialDays } = useCalendarRange(dateISO, dateISO)

  const navigate = useNavigate()

  // Mutations
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const upsertNote = useUpsertDayNote()

  // UI state
  const [confirmItem, setConfirmItem] = useState<ContentItem | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [driveDraft, setDriveDraft] = useState('')

  const items = dayItemsQ.data ?? []
  const special = specialDays[0]
  const dayNote = dayNoteQ.data ?? null

  const byType = useMemo(() => {
    const map = new Map<ContentType, ContentItem[]>()
    for (const t of CONTENT_TYPE_ORDER) map.set(t, [])
    for (const it of items) map.get(it.type)?.push(it)
    return map
  }, [items])

  // Keep the day editor in sync with what's loaded / the active day.
  useEffect(() => {
    setNoteDraft(dayNote?.note ?? '')
    setDriveDraft(dayNote?.drive_link ?? '')
  }, [dayNote?.note, dayNote?.drive_link, dateISO])

  const canEdit = isApiConfigured
  const dayDirty =
    noteDraft !== (dayNote?.note ?? '') ||
    driveDraft !== (dayNote?.drive_link ?? '')

  // Add / edit now open the dedicated compose page instead of a popup.
  const openAdd = (type: ContentType) =>
    navigate(`/compose?date=${dateISO}&type=${type}`)
  const openEdit = (item: ContentItem) =>
    navigate(`/compose?date=${dateISO}&edit=${item.id}`)

  function handleDelete() {
    if (!confirmItem) return
    deleteItem.mutate(
      { id: confirmItem.id, mediaPaths: confirmItem.media.map((m) => m.path) },
      {
        onSuccess: () => setConfirmItem(null),
        onError: (e) => {
          setConfirmItem(null)
          setPageError(humanError(e))
        },
      },
    )
  }

  function saveDay() {
    setPageError(null)
    upsertNote.mutate(
      { date: dateISO, note: noteDraft, drive_link: driveDraft.trim() || null },
      { onError: (e) => setPageError(humanError(e)) },
    )
  }

  function changeStatus(item: ContentItem, status: ContentStatus) {
    if (status === item.status) return
    setPageError(null)
    updateItem.mutate(
      { id: item.id, patch: { status } },
      { onError: (e) => setPageError(humanError(e)) },
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Reveal>
        <div className="card">
        <div className="flex items-start gap-4">
          <div className="grid flex-none place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100/60 px-4 py-2.5 text-center leading-none ring-1 ring-brand-100">
            <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
              {dayOfWeek.slice(0, 3)}
            </div>
            <div className="mt-1 text-4xl font-extrabold text-brand-700">
              {d.getDate()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-500">
              {formatLongDate(d).replace(`${dayOfWeek}, `, '')}
            </div>
            {special ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-900">
                <span aria-hidden>🎉</span>
                {special.label}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      </Reveal>

      {pageError ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {pageError}
        </p>
      ) : null}

      {/* Day folder + notes */}
      <Reveal delay={0.06}>
        <div className="card">
        <h3 className="text-sm font-bold text-slate-900">This day</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          One Drive folder + a shared note for everything on this date.
        </p>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            📂 Drive folder for this day
          </span>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              inputMode="url"
              value={driveDraft}
              disabled={!canEdit}
              onChange={(e) => setDriveDraft(e.target.value)}
              placeholder="https://drive.google.com/…  (this date's posts, reels & stories)"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 disabled:bg-slate-50"
            />
            {dayNote?.drive_link ? (
              <a
                href={dayNote.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-none items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
              >
                📂 Open folder
              </a>
            ) : null}
          </div>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Day note</span>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 disabled:bg-slate-50"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            disabled={!canEdit}
            placeholder={
              canEdit
                ? 'e.g. Big festival push — keep captions cheerful.'
                : 'Connect the backend to add day notes.'
            }
          />
        </label>

        {canEdit ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={saveDay}
              disabled={!dayDirty || upsertNote.isPending}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {upsertNote.isPending ? 'Saving…' : 'Save'}
            </button>
            {!dayDirty && dayNote ? (
              <span className="text-xs text-slate-500">Saved</span>
            ) : null}
          </div>
        ) : null}
        </div>
      </Reveal>

      {/* Add buttons */}
      <Reveal delay={0.12}>
        <div className="card">
          <h3 className="text-sm font-bold text-slate-900">
            Add <span className="text-grainient">something</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick what you want to plan for this day.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:items-start lg:pb-5">
            {ADD_TYPES.map((t, i) => {
              const meta = CONTENT_TYPE_META[t]
              const Icon = ADD_ICONS[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => openAdd(t)}
                  disabled={!canEdit}
                  title={canEdit ? `Add a ${meta.label}` : 'Connect the backend to add content'}
                  aria-label={`Add a ${meta.label}`}
                  className={`group glass-add min-h-[12.5rem] px-3 pb-5 pt-7 sm:min-h-[13.5rem] ${ADD_STAGGER[i]}`}
                >
                  {/* convex top sheen */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[2rem] bg-gradient-to-b from-white/55 to-transparent"
                  />
                  {/* floating pill */}
                  <span className="relative inline-block rounded-full bg-white/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700 shadow-[0_4px_10px_-4px_rgba(214,46,20,0.35)] ring-1 ring-white/70">
                    {ADD_PILL[t]}
                  </span>
                  {/* centred icon in a frosted disc */}
                  <span className="relative my-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/55 text-brand-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] ring-1 ring-white/60 transition group-enabled:group-hover:bg-white/75 group-enabled:group-hover:text-brand-600">
                    <Icon />
                  </span>
                  {/* uppercase title */}
                  <span className="relative text-sm font-extrabold uppercase tracking-[0.12em] text-brand-900">
                    {meta.label.toUpperCase()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>

      {/* Items grouped by type */}
      {dayItemsQ.isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-500">
            Nothing planned for this day yet. Use the buttons above to add a
            Post, Reel, Story or Caption.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {CONTENT_TYPE_ORDER.map((t, i) => {
            const group = byType.get(t) ?? []
            if (group.length === 0) return null
            return (
              <Reveal key={t} delay={i * 0.04}>
                <section className="card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {CONTENT_TYPE_META[t].plural}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      {group.length}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openAdd(t)}
                    disabled={!canEdit}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                  >
                    + Add a {CONTENT_TYPE_META[t].label}
                  </button>
                </div>
                <div className="space-y-3">
                  {group.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      canEdit={canEdit}
                      onEdit={openEdit}
                      onRemove={setConfirmItem}
                      onStatusChange={changeStatus}
                    />
                  ))}
                </div>
                </section>
              </Reveal>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmItem !== null}
        title="Remove this item?"
        message={`“${confirmItem?.title || 'Untitled'}” will be permanently removed. This can’t be undone.`}
        confirmLabel="Remove"
        busy={deleteItem.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}
