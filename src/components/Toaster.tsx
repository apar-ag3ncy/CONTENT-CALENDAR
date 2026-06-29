import { useEffect, useState } from 'react'
import { subscribe, dismissToast, type ToastItem, type ToastKind } from '../lib/toast'

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 8v5M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

const KIND: Record<ToastKind, { ring: string; chip: string; icon: () => JSX.Element }> = {
  success: { ring: 'ring-emerald-200', chip: 'bg-emerald-500 text-white', icon: IconCheck },
  error: { ring: 'ring-red-200', chip: 'bg-red-500 text-white', icon: IconAlert },
  info: { ring: 'ring-brand-200', chip: 'bg-brand-500 text-white', icon: IconAlert },
}

function ToastCard({ item }: { item: ToastItem }) {
  const meta = KIND[item.kind]
  const Icon = meta.icon
  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/70 bg-white/95 px-3.5 py-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.45)] ring-1 backdrop-blur ${meta.ring}`}
    >
      <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ${meta.chip}`}>
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss"
        className="-mr-1 grid h-6 w-6 flex-none place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <IconClose />
      </button>
    </div>
  )
}

/** Mount once at the app root. Renders all active toasts at the top-right. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribe(setItems), [])

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[200] flex w-[min(92vw,360px)] flex-col gap-2 sm:right-5 sm:top-5">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
