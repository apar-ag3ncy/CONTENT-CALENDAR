import { useEffect, useState } from 'react'
import {
  WEEKDAY_LONG,
  formatLongDate,
  parseISODate,
  weekdayMonFirst,
} from '../lib/dates'
import { CONTENT_TYPE_META } from '../lib/contentMeta'
import { ConfirmDialog } from './ConfirmDialog'
import { Reveal } from './Reveal'
import { CopyButton, DayFeed } from './FeedPost'
import { DayNotesThread } from './DayNotesThread'
import { useDayItems, useDayNote } from '../hooks/useDayData'
import { useCalendarRange } from '../hooks/useCalendarData'
import {
  useUpdateItem,
  useDeleteItem,
  useUpsertDayNote,
} from '../hooks/useMutations'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkspaceName, useCanEdit } from '../lib/auth'
import { humanError } from '../lib/errors'
import type { ContentItem, ContentStatus, ContentType } from '../types/database'

const ADD_TYPES: ContentType[] = ['post', 'reel', 'story', 'caption']

// --- Monoline glyphs for the glass "Add something" cards --------------------
const IconPost = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="M4 16.5l4.2-4a2 2 0 0 1 2.7-.1l3.1 2.8M14 14l1.8-1.7a2 2 0 0 1 2.7 0l1.5 1.4" />
  </svg>
)
const IconReel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
    <path d="M3.5 9h17M8 4.7l2.4 4.3M13.4 4.7l2.4 4.3" />
    <path d="M10.6 12.3v4.4l3.8-2.2z" fill="currentColor" stroke="none" />
  </svg>
)
const IconStory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.4" />
    <path d="M12 7.6V12l3 1.9" />
  </svg>
)
const IconCaption = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <path d="M5 5.5h14a1.6 1.6 0 0 1 1.6 1.6v7.4a1.6 1.6 0 0 1-1.6 1.6h-8.4l-4 3v-3H5A1.6 1.6 0 0 1 3.4 14.5V7.1A1.6 1.6 0 0 1 5 5.5Z" />
    <path d="M7 9.5h10M7 12.5h6" />
  </svg>
)

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

/** Wireframe placeholder shown while a day's content loads (and auto-retries). */
function FeedSkeleton({ attempt, maxAttempts }: { attempt?: number; maxAttempts?: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-6" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="mx-auto w-full max-w-[30rem] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10">
            <div className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
              </div>
            </div>
            <div className="aspect-[4/5] w-full animate-pulse bg-slate-100 dark:bg-white/5" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400" role="status">
        Loading this day’s content…
        {attempt && attempt > 1 ? ` (retrying — ${attempt}/${maxAttempts})` : ''}
      </p>
    </div>
  )
}

export function DayContent({ dateISO }: { dateISO: string }) {
  const d = parseISODate(dateISO)
  const dayOfWeek = WEEKDAY_LONG[weekdayMonFirst(d)]
  const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Data
  const dayItemsQ = useDayItems(dateISO)
  const dayNoteQ = useDayNote(dateISO)
  const { specialDays } = useCalendarRange(dateISO, dateISO)

  const navigate = useNavigate()
  const brand = useActiveWorkspaceName() ?? 'chheda jewellers'

  // Mutations
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const upsertNote = useUpsertDayNote()

  // UI state
  const [confirmItem, setConfirmItem] = useState<ContentItem | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [driveDraft, setDriveDraft] = useState('')

  const items = dayItemsQ.items
  const special = specialDays[0]
  const dayNote = dayNoteQ.data ?? null

  // Keep the day editor in sync with what's loaded / the active day.
  useEffect(() => {
    setNoteDraft(dayNote?.note ?? '')
    setDriveDraft(dayNote?.drive_link ?? '')
  }, [dayNote?.note, dayNote?.drive_link, dateISO])

  const canEdit = useCanEdit()
  const dayDirty =
    noteDraft !== (dayNote?.note ?? '') ||
    driveDraft !== (dayNote?.drive_link ?? '')

  // Add / edit open the dedicated compose page.
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
          <div className="grid flex-none place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100/60 px-4 py-2.5 text-center leading-none ring-1 ring-brand-100 dark:from-brand-500/20 dark:to-brand-600/10 dark:ring-brand-500/30">
            <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">
              {dayOfWeek.slice(0, 3)}
            </div>
            <div className="mt-1 text-4xl font-extrabold text-brand-700 dark:text-brand-300">
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

      {/* ── The day brief: team edits a Drive folder + note; clients just read it ── */}
      {canEdit ? (
        <Reveal delay={0.06}>
          <div className="card">
            <h3 className="text-sm font-bold text-slate-900">This day</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              One Drive folder + a shared note for everything on this date.
            </p>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">📂 Drive folder for this day</span>
              <div className="flex flex-wrap gap-2">
                <input
                  type="url"
                  inputMode="url"
                  value={driveDraft}
                  onChange={(e) => setDriveDraft(e.target.value)}
                  placeholder="https://drive.google.com/…  (this date's posts, reels & stories)"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400"
                />
                {dayNote?.drive_link ? (
                  <>
                    <a
                      href={dayNote.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-none items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                    >
                      📂 Open
                    </a>
                    <CopyButton text={dayNote.drive_link} label="Copy link" className="flex-none px-3 py-2" />
                  </>
                ) : null}
              </div>
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Day note</span>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="e.g. Big festival push — keep captions cheerful."
              />
            </label>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={saveDay}
                disabled={!dayDirty || upsertNote.isPending}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {upsertNote.isPending ? 'Saving…' : 'Save'}
              </button>
              {!dayDirty && dayNote ? <span className="text-xs text-slate-500">Saved</span> : null}
              {dayNote?.note ? <CopyButton text={dayNote.note} label="Copy note" className="ml-auto" /> : null}
            </div>
          </div>
        </Reveal>
      ) : dayNote?.note ? (
        <Reveal delay={0.06}>
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">📝 Note from the Apar team</h3>
              <CopyButton text={dayNote.note} label="Copy" />
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-300">
              {dayNote.note}
            </p>
          </div>
        </Reveal>
      ) : null}

      {/* Add buttons — authoring only (hidden for review-only clients). */}
      {canEdit ? (
      <Reveal delay={0.12}>
        <div className="card">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Add to this day</h3>
            <span className="text-[11px] text-slate-400">Post · Reel · Story · Caption</span>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ADD_TYPES.map((t) => {
              const meta = CONTENT_TYPE_META[t]
              const Icon = ADD_ICONS[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => openAdd(t)}
                  title={`Add a ${meta.label}`}
                  aria-label={`Add a ${meta.label}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-white/10 dark:bg-transparent dark:hover:border-brand-500/40 dark:hover:bg-white/[0.03]"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-brand-100 group-hover:text-brand-600 dark:bg-white/5 dark:text-slate-300">
                    <Icon />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-semibold text-slate-900">{meta.label}</span>
                    <span className="block text-[11px] text-slate-400">{ADD_PILL[t]}</span>
                  </span>
                  <svg className="ml-auto h-4 w-4 flex-none text-slate-300 transition group-hover:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>
      ) : null}

      {/* The day, as an Instagram feed. We show the wireframe while the content
          loads AND while it auto-retries (up to 5×), so a flaky first fetch on
          the live API never shows a false "Nothing planned". */}
      {dayItemsQ.isResolving ? (
        <FeedSkeleton attempt={dayItemsQ.attempt} maxAttempts={dayItemsQ.maxAttempts} />
      ) : dayItemsQ.failed ? (
        <div className="card rounded-xl border border-dashed border-amber-300 bg-amber-50/60 py-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Couldn’t load this day’s content after {dayItemsQ.maxAttempts} tries.
          </p>
          <button
            type="button"
            onClick={() => dayItemsQ.retry()}
            className="btn-primary mt-3 px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="card rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-500">
            Nothing planned for this day yet.
            {canEdit ? ' Use the buttons above to add a Post, Reel, Story or Caption.' : ''}
          </p>
        </div>
      ) : (
        <DayFeed
          items={items}
          brand={brand}
          dateLabel={dateLabel}
          canEdit={canEdit}
          onEdit={openEdit}
          onRemove={setConfirmItem}
          onStatus={changeStatus}
        />
      )}

      {/* Client ↔ Apar team notes & suggestions for this day */}
      <DayNotesThread dateISO={dateISO} />

      {/* Clients see the Drive folder at the very bottom of the page */}
      {!canEdit && dayNote?.drive_link ? (
        <div className="card">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand-100 text-xl text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              📂
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900">Drive folder for this day</h3>
              <p className="truncate text-xs text-slate-500">{dayNote.drive_link}</p>
            </div>
            <CopyButton text={dayNote.drive_link} label="Copy link" className="flex-none" />
            <a
              href={dayNote.drive_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-none px-4 py-2 text-sm"
            >
              Open folder
            </a>
          </div>
        </div>
      ) : null}

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
