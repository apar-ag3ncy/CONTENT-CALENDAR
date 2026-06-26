import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage, isFirebaseConfigured } from '../lib/firebase'
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
 * Firebase Storage `media/` prefix and reports the download URL + storage path
 * back via onChange. Supports single or multiple files (e.g. Instagram
 * carousels) and renders a preview for each item with a remove (×) control.
 */
export function DropZone({
  value,
  onChange,
  multiple = false,
  disabled = false,
  accept = 'image/*,video/*',
}: {
  value: MediaItem[]
  onChange: (value: MediaItem[]) => void
  multiple?: boolean
  disabled?: boolean
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  // Paths uploaded in THIS session (not yet necessarily saved to the DB).
  const sessionPaths = useRef<Set<string>>(new Set())
  // Latest value, so async uploads always append to the freshest array even if
  // several files resolve back-to-back.
  const valueRef = useRef(value)
  valueRef.current = value
  useEffect(() => () => void (mountedRef.current = false), [])

  const canUpload = isFirebaseConfigured && !disabled && !uploading

  async function uploadOne(file: File): Promise<MediaItem | null> {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
    const path = `media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const r = ref(storage, path)
    await uploadBytes(r, file)
    const url = await getDownloadURL(r)
    if (!mountedRef.current) {
      // Form was closed mid-upload — clean up the orphan instead of leaking it.
      await deleteObject(ref(storage, path)).catch(() => {})
      return null
    }
    sessionPaths.current.add(path)
    return { url, path, name: file.name }
  }

  async function handleFiles(files: File[]) {
    setError(null)
    if (!isFirebaseConfigured) {
      setError('Connect Firebase to upload files.')
      return
    }
    if (files.length === 0) return
    // Single-file mode keeps only the most recent selection.
    const list = multiple ? files : files.slice(-1)
    setUploading(true)
    try {
      for (const file of list) {
        const item = await uploadOne(file)
        if (!mountedRef.current || !item) return
        const base = multiple ? valueRef.current : []
        onChange([...base, item])
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
      }
    } finally {
      if (mountedRef.current) setUploading(false)
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
    if (sessionPaths.current.has(item.path) && isFirebaseConfigured) {
      sessionPaths.current.delete(item.path)
      await deleteObject(ref(storage, item.path)).catch(() => {})
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
                className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
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
                  <div className="grid h-14 w-14 flex-none place-items-center rounded-lg bg-slate-100 text-slate-400">
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
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span
          className={`grid h-11 w-11 place-items-center rounded-full shadow-sm ring-1 transition ${
            dragOver
              ? 'bg-brand-100 text-brand-600 ring-brand-100'
              : 'bg-white text-slate-400 ring-slate-100'
          }`}
          aria-hidden
        >
          <IconUpload />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {uploading ? 'Uploading…' : 'Drop files or browse'}
        </span>
        <span className="text-xs text-slate-400">
          {isFirebaseConfigured
            ? multiple
              ? 'Photos or videos — add as many as you like'
              : 'Photos or videos'
            : 'Connect Firebase to upload files'}
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
