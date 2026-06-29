import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import type {
  Category,
  ContentItem,
  ContentStatus,
  ContentType,
  MediaItem,
  MediaType,
  PostFormat,
  TeamMember,
} from '../types/database'
import {
  CONTENT_TYPE_META,
  POST_FORMAT_META,
  POST_FORMAT_ORDER,
  STATUS_META,
  STATUS_ORDER,
} from '../lib/contentMeta'
import { DropZone } from './DropZone'

export interface ContentFormValues {
  date: string
  day_of_week: string
  type: ContentType
  post_format: PostFormat | null
  media_type: MediaType | null
  media: MediaItem[]
  title: string | null
  caption: string | null
  drive_link: string | null
  category_id: string | null
  assigned_to: string | null
  status: ContentStatus
  notes: string | null
  grid_position: number | null
}

// --- Monoline icons (stroke, currentColor, sized via className) -------------
function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-5 w-5'}
    >
      {children}
    </svg>
  )
}

const IconPost = () => (
  <Svg className="h-6 w-6">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m3 16 5-4 4 3 3-2 6 4" />
    <circle cx="8.5" cy="8" r="1.3" />
  </Svg>
)
const IconReel = () => (
  <Svg className="h-6 w-6">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M3 8h18M9 3l2.4 5M15 3l2.4 5" />
    <path d="m10 12 4.5 2.5L10 17z" />
  </Svg>
)
const IconStory = () => (
  <Svg className="h-6 w-6">
    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />
    <path d="m10.5 9 4 3-4 3z" />
  </Svg>
)
const IconCaption = () => (
  <Svg className="h-6 w-6">
    <path d="M4 6h16M4 11h11M4 16h7" />
  </Svg>
)
const IconPlus = () => (
  <Svg className="h-4 w-4">
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
const IconCheck = () => (
  <Svg className="h-4 w-4">
    <path d="m5 13 4 4L19 7" />
  </Svg>
)

const TYPE_OPTIONS: { value: ContentType; label: string; sub: string }[] = [
  { value: 'post', label: 'Post', sub: 'Feed' },
  { value: 'reel', label: 'Reel', sub: 'Video' },
  { value: 'story', label: 'Story', sub: '24h' },
  { value: 'caption', label: 'Caption', sub: 'Words' },
]

const TYPE_ICONS: Record<ContentType, () => JSX.Element> = {
  post: IconPost,
  reel: IconReel,
  story: IconStory,
  caption: IconCaption,
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1.5 rounded-2xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
            value === o.value
              ? 'bg-gradient-to-br from-flame-500 to-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(214,46,20,0.8)]'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function TypeTabs({
  value,
  onChange,
}: {
  value: ContentType
  onChange: (v: ContentType) => void
}) {
  return (
    <div role="group" aria-label="Content type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TYPE_OPTIONS.map((o) => {
        const active = value === o.value
        const Icon = TYPE_ICONS[o.value]
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
              active
                ? 'border-transparent bg-gradient-to-br from-flame-500 to-brand-600 text-white shadow-[0_12px_26px_-12px_rgba(214,46,20,0.75)]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-flame-300 hover:bg-flame-50/60'
            }`}
          >
            <span
              className={`grid h-10 w-10 flex-none place-items-center rounded-xl transition ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-flame-600 group-hover:bg-white'
              }`}
            >
              <Icon />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">{o.label}</span>
              <span className={`block text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-white/75' : 'text-slate-400'}`}>
                {o.sub}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CardHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-flame-700">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-flame-200/70 to-transparent" />
    </div>
  )
}

function Field({
  label,
  children,
  error,
  hint,
  errorId,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  errorId?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

export function ContentForm({
  dateISO,
  dayOfWeek,
  existing,
  presetType,
  categories,
  teamMembers,
  saving,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  dateISO: string
  dayOfWeek: string
  existing: ContentItem | null
  presetType?: ContentType
  categories: Category[]
  teamMembers: TeamMember[]
  saving: boolean
  errorMessage?: string | null
  onSubmit: (values: ContentFormValues) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<ContentType>(
    existing?.type ?? presetType ?? 'post',
  )
  const [format, setFormat] = useState<PostFormat>(
    existing?.post_format ?? 'static',
  )
  const [mediaType, setMediaType] = useState<MediaType>(
    existing?.media_type ?? (existing?.type === 'reel' ? 'video' : 'photo'),
  )
  const [media, setMedia] = useState<MediaItem[]>(existing?.media ?? [])
  const [title, setTitle] = useState(existing?.title ?? '')
  const [caption, setCaption] = useState(existing?.caption ?? '')
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '')
  const [driveLink, setDriveLink] = useState(existing?.drive_link ?? '')
  const [assignedTo, setAssignedTo] = useState(existing?.assigned_to ?? '')
  const [status, setStatus] = useState<ContentStatus>(existing?.status ?? 'idea')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [touched, setTouched] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const isCaption = type === 'caption'
  const isCarousel = type === 'post' && format === 'carousel'
  const titleError = title.trim() === '' ? 'Please add a short title.' : ''
  const driveError =
    driveLink.trim() !== '' && !/^https?:\/\//i.test(driveLink.trim())
      ? 'Link should start with http:// or https://'
      : ''

  function handleType(next: ContentType) {
    setType(next)
    // Sensible default media type: reels are usually video, everything else photo.
    setMediaType(next === 'reel' ? 'video' : 'photo')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (titleError || driveError) {
      if (titleError) {
        titleRef.current?.focus()
        titleRef.current?.scrollIntoView({ block: 'center' })
      }
      return
    }
    onSubmit({
      date: dateISO,
      day_of_week: dayOfWeek,
      type,
      post_format: type === 'post' ? format : null,
      media_type: isCaption ? null : mediaType,
      media: isCaption ? [] : media,
      title: title.trim() || null,
      caption: caption.trim() || null,
      drive_link: driveLink.trim() || null,
      category_id: categoryId || null,
      assigned_to: assignedTo || null,
      status,
      notes: notes.trim() || null,
      grid_position: existing?.grid_position ?? null,
    })
  }

  const submitLabel = existing
    ? 'Save changes'
    : `Add ${CONTENT_TYPE_META[type].label}`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Type selector ───────────────────────────── */}
      <div className="pin-card p-3 sm:p-4">
        <TypeTabs value={type} onChange={handleType} />
      </div>

      {/* ── Two-panel: media (left) · details (right) ── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* LEFT — media */}
        {!isCaption ? (
          <div className="pin-card space-y-4 p-4 sm:p-5">
            <CardHead>Media</CardHead>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {type === 'post' ? (
                <div>
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">Format</span>
                  <Segmented
                    ariaLabel="Post format"
                    value={format}
                    onChange={setFormat}
                    options={POST_FORMAT_ORDER.map((f) => ({ value: f, label: POST_FORMAT_META[f].label }))}
                  />
                </div>
              ) : null}
              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">Type</span>
                <Segmented
                  ariaLabel="Media type"
                  value={mediaType}
                  onChange={setMediaType}
                  options={[
                    { value: 'photo', label: 'Photo' },
                    { value: 'video', label: 'Video' },
                  ]}
                />
              </div>
            </div>
            <DropZone value={media} onChange={setMedia} multiple={isCarousel} tall />
            <p className="text-center text-xs text-slate-400">
              {isCarousel ? 'Carousel — add several photos.' : 'Drag a file in, or click to browse. Saved to MongoDB.'}
            </p>
          </div>
        ) : (
          <div className="pin-card grid place-items-center p-6 text-center">
            <div className="max-w-[16rem]">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-flame-100 to-brand-50 text-flame-600">
                <IconCaption />
              </span>
              <p className="mt-4 text-sm font-bold text-slate-700">Captions are text-only</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                No media needed — just write the words on the right.
              </p>
            </div>
          </div>
        )}

        {/* RIGHT — details */}
        <div className="pin-card space-y-4 p-5 sm:p-6">
          <CardHead>Details</CardHead>

          <Field label="Title" error={touched ? titleError : ''} errorId="title-error">
            <input
              ref={titleRef}
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Statement set — hero shot"
              aria-invalid={touched && titleError ? true : undefined}
              aria-describedby={touched && titleError ? 'title-error' : undefined}
            />
          </Field>

          <Field label="Caption">
            <textarea
              className={`${inputCls} min-h-[96px]`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="The words that go with this content…"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Drive link"
            error={touched ? driveError : ''}
            hint={isCaption ? undefined : 'Optional — paste a Google Drive share link too.'}
          >
            <input
              className={inputCls}
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/…"
              inputMode="url"
            />
          </Field>

          <Field
            label="Assigned to"
            hint={teamMembers.length === 0 ? 'Add team members in Settings to assign work.' : undefined}
          >
            <select
              className={inputCls}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={teamMembers.length === 0}
            >
              <option value="">— Unassigned —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || 'Unnamed'}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              className={`${inputCls} min-h-[64px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the team should know… (optional)"
            />
          </Field>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-white/30 bg-black/20 px-3.5 py-2.5 text-sm font-medium text-white backdrop-blur">
          {errorMessage}
        </p>
      ) : null}

      {/* ── Action bar (on the canvas) ───────────────── */}
      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.12] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20 active:scale-[.98]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition hover:bg-cream active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!saving ? (existing ? <IconCheck /> : <IconPlus />) : null}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
