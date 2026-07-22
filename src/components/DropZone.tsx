import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, isApiConfigured } from '../lib/api'
import { toast } from '../lib/toast'
import { UploadProgress, type UploadState } from './UploadProgress'
import type { MediaItem } from '../types/database'

/** Re-export alias kept for compatibility with existing imports. */
export type UploadedMedia = MediaItem

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i

// --- Monoline icons ---------------------------------------------------------
const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M5 19.5h14" />
  </svg>
)
const IconFilm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
)
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

/**
 * Reusable drag-and-drop / click-to-browse uploader. Uploads each file to the
 * backend (POST /api/media; the PHP backend stores it on disk under media/) and
 * reports the served URL + storage path back via onChange. Supports single or
 * multiple files (e.g. Instagram carousels) and renders a preview for each item
 * with a remove (×) control.
 */
export function DropZone({
  value,
  onChange,
  multiple = false,
  disabled = false,
  accept = 'image/*,video/*',
  tall = false,
  onUploadingChange,
}: {
  value: MediaItem[]
  onChange: (value: MediaItem[]) => void
  multiple?: boolean
  disabled?: boolean
  accept?: string
  tall?: boolean
  /**
   * Fires whenever an upload starts/stops. The parent form needs this to block
   * Save while bytes are still in flight — otherwise it submits `media: []`,
   * the item is created with no media, and this component's unmount cleanup
   * then deletes the just-uploaded file from the server.
   */
  onUploadingChange?: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  // Paths uploaded in THIS session (not yet necessarily saved to the DB).
  const sessionPaths = useRef<Set<string>>(new Set())
  // Latest value, so async uploads always append to the freshest array even if
  // several files resolve back-to-back.
  const valueRef = useRef(value)
  valueRef.current = value
  // Held in a ref so the unmount cleanup always calls the latest callback.
  const busyCbRef = useRef(onUploadingChange)
  busyCbRef.current = onUploadingChange

  /** Set the busy flag and tell the parent, so Save can be blocked in step. */
  function setBusy(busy: boolean) {
    setUploading(busy)
    busyCbRef.current?.(busy)
  }

  useEffect(() => {
    // Re-set on mount so a StrictMode remount doesn't leave us flagged unmounted.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Release the parent's lock on unmount. Without this, switching the type
      // tab to Caption mid-upload unmounts this component and would strand the
      // form's `uploading` flag at true — permanently disabling Save.
      busyCbRef.current?.(false)
    }
  }, [])

  const canUpload = isApiConfigured && !disabled && !uploading

  async function uploadOne(file: File, index: number, count: number): Promise<MediaItem | null> {
    // file.size is known up front, so the meter starts at a real 0% rather than
    // sitting indeterminate until the first progress event lands.
    setProgress({ name: file.name, loaded: 0, total: file.size, index, count, startedAt: Date.now() })
    const item = await api.uploadMedia(file, (loaded, total) => {
      if (!mountedRef.current) return
      setProgress((p) => (p ? { ...p, loaded, total: total || p.total } : p))
    })
    if (!mountedRef.current) {
      // Form was closed mid-upload — clean up the orphan instead of leaking it.
      await api.deleteMedia(item.path).catch(() => {})
      return null
    }
    sessionPaths.current.add(item.path)
    return item
  }

  async function handleFiles(files: File[]) {
    setError(null)
    if (!isApiConfigured) {
      setError('Connect the backend (set VITE_API_URL) to upload files.')
      return
    }
    if (files.length === 0) return
    // Single-file mode takes ONE file. A drag-drop of several lands on the
    // wrapping button, not the <input>, so `multiple={false}` doesn't constrain
    // it — without this the extras were dropped in silence. Keep the first
    // (what the user sees at the front of the drag) and say so.
    const list = multiple ? files : files.slice(0, 1)
    if (!multiple && files.length > 1) {
      toast.info(
        'Only one file added',
        `This post takes a single file — kept “${list[0].name}”. Switch Format to Carousel to add several.`,
      )
    }
    setBusy(true)
    try {
      for (const [i, file] of list.entries()) {
        const item = await uploadOne(file, i + 1, list.length)
        if (!mountedRef.current || !item) return
        // Single-file mode REPLACES the previous selection. If we uploaded that
        // previous file this session and it was never saved to an item, delete
        // it — otherwise it sits on the server forever referenced by nothing,
        // quietly eating the hosting disk quota.
        if (!multiple) {
          for (const prev of valueRef.current) {
            if (sessionPaths.current.has(prev.path)) {
              sessionPaths.current.delete(prev.path)
              void api.deleteMedia(prev.path).catch(() => {})
            }
          }
        }
        const base = multiple ? valueRef.current : []
        onChange([...base, item])
        // Notify (top-right) once the file is stored on the server.
        toast.success('Added successfully', `“${file.name}” uploaded.`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed. Please try again.'
      if (mountedRef.current) setError(msg)
      toast.error('Couldn’t add — try again', msg)
    } finally {
      if (mountedRef.current) {
        setBusy(false)
        setProgress(null)
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (!canUpload) return
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) void handleFiles(files)
  }

  async function remove(item: MediaItem) {
    setError(null)
    onChange(valueRef.current.filter((m) => m.path !== item.path))
    // Only delete from storage if WE uploaded it this session. A pre-existing
    // saved file is left alone so cancelling the edit can't strand a dead link.
    if (sessionPaths.current.has(item.path) && isApiConfigured) {
      sessionPaths.current.delete(item.path)
      await api.deleteMedia(item.path).catch(() => {})
    }
  }

  return (
    <div>
      {value.length > 0 ? (
        <div className={`mb-2 ${multiple ? 'flex flex-wrap gap-2' : 'space-y-2'}`}>
          {value.map((item) => {
            const isImage = IMAGE_RE.test(item.name)
            return (
              <div
                key={item.path}
                className={`flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 p-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] backdrop-blur dark:border-white/10 dark:bg-white/10 ${
                  multiple ? 'w-full max-w-xs' : ''
                }`}
              >
                {isImage ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-14 w-14 flex-none rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 flex-none place-items-center rounded-lg bg-white/70 text-flame-500">
                    <IconFilm />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.name}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Open file
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  aria-label={`Remove ${item.name}`}
                  className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <IconX />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Live progress sits directly above the drop target, so the eye stays in
          the same place it just dropped the file. */}
      {progress ? <UploadProgress state={progress} /> : null}

      <button
        type="button"
        disabled={!canUpload}
        aria-label={multiple ? 'Upload files' : 'Upload a file'}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (canUpload) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center backdrop-blur transition ${
          tall ? 'py-16 sm:py-20' : 'py-8'
        } ${
          dragOver
            ? 'border-brand-400 bg-brand-50/70'
            : 'border-flame-200/70 bg-white/45 hover:border-brand-300 hover:bg-flame-50/50'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span
          className={`grid h-11 w-11 place-items-center rounded-full shadow-sm ring-1 transition ${
            dragOver
              ? 'bg-brand-100 text-brand-600 ring-brand-100'
              : 'bg-white/80 text-flame-500 ring-white/70'
          }`}
          aria-hidden
        >
          <IconUpload />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {uploading ? 'Uploading…' : 'Drop files or browse'}
        </span>
        <span className="text-xs text-slate-400">
          {isApiConfigured
            ? multiple
              ? 'Photos or videos — add as many as you like'
              : 'Photos or videos'
            : 'Connect the backend to upload files'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) void handleFiles(files)
          e.target.value = ''
        }}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
