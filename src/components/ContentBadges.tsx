import type { ContentItem, ContentType, ContentStatus } from '../types/database'
import {
  CONTENT_TYPE_META,
  CONTENT_TYPE_ORDER,
  statusMeta,
} from '../lib/contentMeta'
import { countByType } from '../lib/calendar'

/** Compact coloured dots + counts for a day cell (Month view). */
export function TypeDots({ items }: { items: ContentItem[] }) {
  if (items.length === 0) return null
  const counts = countByType(items)
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {CONTENT_TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-600"
          title={`${counts[t]} ${counts[t] === 1 ? CONTENT_TYPE_META[t].label : CONTENT_TYPE_META[t].plural}`}
        >
          <span className={`h-2 w-2 rounded-full ${CONTENT_TYPE_META[t].dot}`} />
          {counts[t]}
        </span>
      ))}
    </div>
  )
}

/** A single labelled type chip (Week / Day views). */
export function TypeChip({ type }: { type: ContentType }) {
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

export function StatusChip({ status }: { status: ContentStatus }) {
  const meta = statusMeta(status)
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
    >
      {meta.label}
    </span>
  )
}
