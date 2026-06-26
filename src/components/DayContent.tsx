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
} from '../lib/contentMeta'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { ContentForm, type ContentFormValues } from './ContentForm'
import { Reveal } from './Reveal'
import { useDayItems, useDayNote } from '../hooks/useDayData'
import { useCalendarRange } from '../hooks/useCalendarData'
import { useCategories } from '../hooks/useReferenceData'
import { useTeamMembers } from '../hooks/useAdminData'
import {
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useUpsertDayNote,
} from '../hooks/useMutations'
import { isFirebaseConfigured } from '../lib/firebase'
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

const ADD_TYPES: ContentType[] = ['post', 'reel', 'story', 'caption']

function ItemCard({
  item,
  categoryName,
  assigneeName,
  canEdit,
  onEdit,
  onRemove,
  onStatusChange,
}: {
  item: ContentItem
  categoryName: string | null
  assigneeName: string | null
  canEdit: boolean
  onEdit: (item: ContentItem) => void
  onRemove: (item: ContentItem) => void
  onStatusChange: (item: ContentItem, status: ContentStatus) => void
}) {
  const images = item.media.filter(isImageThumb)
  const videos = item.media.filter((m) => !isImageThumb(m))
  const firstMedia = item.media[0] ?? null

  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
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

      {categoryName || assigneeName || item.notes ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {categoryName ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              {categoryName}
            </span>
          ) : null}
          {assigneeName ? <span>👤 {assigneeName}</span> : null}
          {item.notes ? <span className="italic">“{item.notes}”</span> : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.drive_link ? (
          <a
            href={item.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
          >
            📂 Open in Drive
          </a>
        ) : null}
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
  const meta = STATUS_META[status]
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

export function DayContent({ dateISO }: { dateISO: string }) {
  const d = parseISODate(dateISO)
  const dayOfWeek = WEEKDAY_LONG[weekdayMonFirst(d)]

  // Data
  const dayItemsQ = useDayItems(dateISO)
  const dayNoteQ = useDayNote(dateISO)
  const { specialDays } = useCalendarRange(dateISO, dateISO)
  const categoriesQ = useCategories()
  const teamMembersQ = useTeamMembers()

  // Mutations
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const upsertNote = useUpsertDayNote()

  // UI state
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [presetType, setPresetType] = useState<ContentType>('post')
  const [confirmItem, setConfirmItem] = useState<ContentItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const items = dayItemsQ.data ?? []
  const categories = categoriesQ.data ?? []
  const teamMembers = teamMembersQ.data ?? []
  const special = specialDays[0]
  const dayNote = dayNoteQ.data ?? null

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? (map.get(id) ?? null) : null)
  }, [categories])

  const teamMemberName = useMemo(() => {
    const map = new Map(teamMembers.map((m) => [m.id, m.name]))
    return (id: string | null) => (id ? (map.get(id) ?? null) : null)
  }, [teamMembers])

  const byType = useMemo(() => {
    const map = new Map<ContentType, ContentItem[]>()
    for (const t of CONTENT_TYPE_ORDER) map.set(t, [])
    for (const it of items) map.get(it.type)?.push(it)
    return map
  }, [items])

  // Keep the note editor in sync with what's loaded / the active day.
  useEffect(() => {
    setNoteDraft(dayNote?.note ?? '')
  }, [dayNote?.note, dateISO])

  const canEdit = isFirebaseConfigured
  const noteDirty = noteDraft !== (dayNote?.note ?? '')
  const saving = createItem.isPending || updateItem.isPending

  function openAdd(type: ContentType) {
    setEditingItem(null)
    setPresetType(type)
    setFormError(null)
    setFormOpen(true)
  }
  function openEdit(item: ContentItem) {
    setEditingItem(item)
    setFormError(null)
    setFormOpen(true)
  }
  function closeForm() {
    setFormOpen(false)
    setEditingItem(null)
  }

  function handleSubmit(values: ContentFormValues) {
    setFormError(null)
    if (editingItem) {
      updateItem.mutate(
        { id: editingItem.id, patch: values },
        { onSuccess: closeForm, onError: (e) => setFormError(humanError(e)) },
      )
    } else {
      createItem.mutate(values, {
        onSuccess: closeForm,
        onError: (e) => setFormError(humanError(e)),
      })
    }
  }

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

  function saveNote() {
    setPageError(null)
    upsertNote.mutate(
      { date: dateISO, note: noteDraft },
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
          <div className="text-center leading-none">
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              {dayOfWeek}
            </div>
            <div className="mt-1 text-4xl font-extrabold text-slate-900">
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

      {/* Day notes */}
      <Reveal delay={0.06}>
        <div className="card">
        <h3 className="text-sm font-bold text-slate-900">Day notes</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          A shared note for the whole team about this day.
        </p>
        <textarea
          className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 disabled:bg-slate-50"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          disabled={!canEdit}
          placeholder={
            canEdit
              ? 'e.g. Big festival push — keep captions cheerful.'
              : 'Connect Firebase to add day notes.'
          }
        />
        {canEdit ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={saveNote}
              disabled={!noteDirty || upsertNote.isPending}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {upsertNote.isPending ? 'Saving…' : 'Save note'}
            </button>
            {!noteDirty && dayNote ? (
              <span className="text-xs text-slate-500">Saved</span>
            ) : null}
          </div>
        ) : null}
        </div>
      </Reveal>

      {/* Add buttons */}
      <Reveal delay={0.12}>
        <div className="card">
        <h3 className="text-sm font-bold text-slate-900">Add something</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Pick what you want to plan for this day.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ADD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => openAdd(t)}
              disabled={!canEdit}
              className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"
              title={canEdit ? undefined : 'Connect Firebase to add content'}
            >
              + Add a {CONTENT_TYPE_META[t].label}
            </button>
          ))}
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
                      categoryName={categoryName(item.category_id)}
                      assigneeName={teamMemberName(item.assigned_to)}
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

      <Modal
        open={formOpen}
        onClose={closeForm}
        accent
        icon={<IconCalendarPlus />}
        title={editingItem ? 'Edit content' : 'Add content'}
        subtitle={formatLongDate(d)}
      >
        <ContentForm
          dateISO={dateISO}
          dayOfWeek={dayOfWeek}
          existing={editingItem}
          presetType={editingItem ? undefined : presetType}
          categories={categories}
          teamMembers={teamMembers}
          saving={saving}
          errorMessage={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>

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
