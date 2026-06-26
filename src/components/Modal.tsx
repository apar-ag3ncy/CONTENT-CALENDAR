import { useRef, type ReactNode } from 'react'
import { useDialog } from '../hooks/useDialog'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  accent,
  icon,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  accent?: boolean
  icon?: ReactNode
  children: ReactNode
}) {
  const panelRef = useDialog(open, onClose)
  // Hold onClose in a ref so the close handlers below stay stable.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => onCloseRef.current()}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl"
      >
        {accent ? (
          <div className="h-1 w-full flex-none bg-brand-600" aria-hidden />
        ) : null}
        <div
          className={`flex flex-none items-start justify-between gap-3 border-b px-5 ${
            accent
              ? 'border-brand-100 bg-gradient-to-b from-brand-50/70 to-white pb-4 pt-4'
              : 'border-slate-100 py-3'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(214,46,20,0.6)]">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold leading-tight tracking-tight text-slate-900">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="grid h-9 w-9 flex-none place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
