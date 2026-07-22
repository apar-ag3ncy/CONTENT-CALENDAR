/**
 * Upload progress meter — the glowing brand-gradient bar shown while media is
 * uploading in the DropZone (posts, reels, stories all share it).
 *
 * Byte counts come from XMLHttpRequest's upload.onprogress (see api.uploadMedia);
 * fetch() cannot report upload progress, which is why that one endpoint is XHR.
 * Styles live in index.css (.up-track / .up-fill / .up-dot) so the gradient can
 * be driven by the --brand-* variables and re-tint per client workspace.
 */

const MB = 1048576

function fmtSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Rough time-left from average throughput so far. Hidden until it's meaningful. */
function fmtEta(loaded: number, total: number, startedAt: number): string | null {
  const elapsed = (Date.now() - startedAt) / 1000
  if (elapsed < 1.5 || loaded <= 0 || total <= 0 || loaded >= total) return null
  const secondsLeft = ((total - loaded) / (loaded / elapsed))
  if (!Number.isFinite(secondsLeft) || secondsLeft < 1) return null
  if (secondsLeft < 60) return `about ${Math.ceil(secondsLeft)}s left`
  return `about ${Math.ceil(secondsLeft / 60)} min left`
}

export interface UploadState {
  name: string
  loaded: number
  total: number
  /** 1-based position when several files are queued. */
  index: number
  count: number
  startedAt: number
}

export function UploadProgress({ state }: { state: UploadState }) {
  const { name, loaded, total, index, count, startedAt } = state
  const known = total > 0
  const pct = known ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  const done = known && loaded >= total
  const eta = known ? fmtEta(loaded, total, startedAt) : null

  return (
    <div className="mb-3 rounded-2xl border border-flame-200/60 bg-white/60 p-3.5 backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
      {/* headline row */}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-neutral-100">
          {done ? 'Finishing up…' : 'Uploading'}
          {count > 1 ? (
            <span className="ml-1.5 font-medium text-slate-400 dark:text-neutral-500">
              {index} of {count}
            </span>
          ) : null}
          <span className="ml-1.5 font-normal text-slate-500 dark:text-neutral-400">“{name}”</span>
        </p>
        <span className="flex-none font-serif text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
          {known ? `${pct}%` : '…'}
        </span>
      </div>

      {/* the meter */}
      <div className="up-track" role="progressbar" aria-label={`Uploading ${name}`}
           aria-valuenow={known ? pct : undefined} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`up-fill${known ? '' : ' is-indeterminate'}`}
          style={known ? { width: `${pct}%` } : undefined}
        />
        {known && pct < 97 ? <span className="up-dot" style={{ left: `calc(${pct}% + 0.85rem)` }} /> : null}
      </div>

      {/* byte counts + time remaining */}
      <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-slate-500 dark:text-neutral-400">
        <span className="tabular-nums">
          {known ? `${fmtSize(loaded)} of ${fmtSize(total)}` : 'Preparing…'}
        </span>
        {eta ? <span className="tabular-nums">{eta}</span> : null}
      </div>
    </div>
  )
}
