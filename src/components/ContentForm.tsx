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
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m3 16 5-4 4 3 3-2 6 4" />
    <circle cx="8.5" cy="8" r="1.3" />
  </Svg>
)
const IconReel = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M3 8h18M9 3l2.4 5M15 3l2.4 5" />
    <path d="m10 12 4.5 2.5L10 17z" />
  </Svg>
)
const IconStory = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />
    <path d="m10.5 9 4 3-4 3z" />
  </Svg>
)
const IconCaption = () => (
  <Svg>
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

const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'caption', label: 'Caption' },
]

const TYPE_ICONS: Record<ContentType, () => JSX.Element> = {
  post: IconPost,
  reel: IconReel,
  story: IconStory,
  caption: IconCaption,
}

const inputCls =
  'glass-field w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 transition placeholder:text-slate-500 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

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
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
            value === o.value
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-white/70 bg-white/50 text-slate-600 backdrop-blur hover:bg-white/80'
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
    <div role="group" aria-label="Content type" className="grid grid-cols-4 gap-2">
      {TYPE_OPTIONS.map((o) => {
        const active = value === o.value
        const Icon = TYPE_ICONS[o.value]
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
              active
                ? 'border-brand-600 bg-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(214,46,20,0.7)]'
                : 'border-white/70 bg-white/55 text-slate-500 backdrop-blur hover:border-flame-200 hover:bg-white/80'
            }`}
          >
            <span className={active ? 'text-white' : 'text-slate-400'}>
              <Icon />
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-flame-700/80">
          {eyebrow}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-flame-200/60 to-transparent" />
      </div>
      {children}
    </section>
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
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* ── Type & format ────────────────────────────── */}
      <Section eyebrow="Type & format">
        <TypeTabs value={type} onChange={handleType} />

        {type === 'post' || !isCaption ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {type === 'post' ? (
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Format
                </span>
                <Segmented
                  ariaLabel="Post format"
                  value={format}
                  onChange={setFormat}
                  options={POST_FORMAT_ORDER.map((f) => ({
                    value: f,
                    label: POST_FORMAT_META[f].label,
                  }))}
                />
              </div>
            ) : null}

            {!isCaption ? (
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Media
                </span>
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
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* ── The content ──────────────────────────────── */}
      <Section eyebrow="The content">
        <Field label="Title" error={touched ? titleError : ''} errorId="title-error">
          <input
            ref={titleRef}
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Khakhra hero shot"
            aria-invalid={touched && titleError ? true : undefined}
            aria-describedby={touched && titleError ? 'title-error' : undefined}
          />
        </Field>

        <Field label="Caption">
          <textarea
            className={`${inputCls} min-h-[88px]`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="The words that go with this content…"
          />
        </Field>

        <Field label="Category">
          <select
            className={inputCls}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Media & workflow ─────────────────────────── */}
      <Section eyebrow="Media & workflow">
        {!isCaption ? (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Photo / video file
            </span>
            <DropZone value={media} onChange={setMedia} multiple={isCarousel} />
          </div>
        ) : null}

        <Field
          label="Drive link"
          error={touched ? driveError : ''}
          hint={
            isCaption
              ? undefined
              : 'Upload above, or paste a Google Drive share link — either works.'
          }
        >
          <input
            className={inputCls}
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="https://drive.google.com/…"
            inputMode="url"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Assigned to"
            hint={
              teamMembers.length === 0
                ? 'Add team members in Settings to assign work.'
                : undefined
            }
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

          <Field label="Status">
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className={`${inputCls} min-h-[64px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the team should know… (optional)"
          />
        </Field>
      </Section>

      {errorMessage ? (
        <p className="rounded-xl border border-brand-200/60 bg-brand-50/80 px-3 py-2 text-sm text-brand-800 backdrop-blur">
          {errorMessage}
        </p>
      ) : null}

      {/* ── Sticky footer action bar — buttons mirror the Home hero (white pill + glass ghost) ── */}
      <div className="sticky bottom-0 -mx-5 -mb-4 mt-2 flex items-center justify-end gap-2.5 rounded-b-3xl border-t border-white/60 bg-white/55 px-5 py-3.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.55] px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-white/70 backdrop-blur transition hover:bg-white/80 active:scale-[.98]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition hover:bg-cream active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!saving ? (existing ? <IconCheck /> : <IconPlus />) : null}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
