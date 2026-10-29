import { useState } from 'react'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { useCreateLock, useDeleteLock } from '../hooks/useLockMutations'
import { humanError } from '../lib/errors'
import { formatLongDate, parseISODate } from '../lib/dates'
import type { LockScope, PeriodLock } from '../types/database'

/**
 * Shows the lock state for a period and lets anyone finalize/unlock it.
 * `label` is the plain noun used in buttons ("month" / "week").
 */
export function FinalizeBar({
  scope,
  label,
  startISO,
  endISO,
  locks,
  canEdit,
}: {
  scope: LockScope
  label: string
  startISO: string
  endISO: string
  locks: PeriodLock[]
  canEdit: boolean
}) {
  // A lock only had to be recognised if it spanned the WHOLE visible range, so
  // a week-scoped lock seen from Month view reported "Not locked — anyone can
  // still edit these days" while the server 423'd exactly those days, and
  // "Unlock" removed nothing. Track every lock that OVERLAPS the range.
  const overlapping = locks.filter(
    (l) => l.start_date <= endISO && l.end_date >= startISO,
  )
  const covering = overlapping.find(
    (l) => l.start_date <= startISO && l.end_date >= endISO,
  )
  const partial = !covering && overlapping.length > 0
  const primary = covering ?? overlapping[0] ?? null
  const create = useCreateLock()
  const del = useDeleteLock()
  const [lockOpen, setLockOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function doLock() {
    setError(null)
    create.mutate(
      {
        scope,
        start_date: startISO,
        end_date: endISO,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setLockOpen(false)
          setNote('')
        },
        onError: (e) => setError(humanError(e)),
      },
    )
  }

  async function doUnlock() {
    if (overlapping.length === 0) return
    setError(null)
    try {
      // Remove every overlapping lock. Deleting only the covering one left the
      // partially-locked days locked while the banner claimed they were free.
      for (const l of overlapping) {
        await del.mutateAsync(l.id)
      }
      setUnlockOpen(false)
    } catch (e) {
      setUnlockOpen(false)
      setError(humanError(e))
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {primary ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3 text-sm">
            <span className="text-lg" aria-hidden>
              {covering ? '✅' : '⚠️'}
            </span>
            <div>
              <div className="font-bold text-emerald-800 dark:text-emerald-200">
                {covering ? 'Locked — follow this plan' : 'Partly locked'}
              </div>
              <div className="text-emerald-700 dark:text-emerald-300/90">
                {covering
                  ? 'Please follow these days as planned.'
                  : `Some days in this ${label} are finalized and can’t be edited: ` +
                    overlapping
                      .map(
                        (l) =>
                          `${formatLongDate(parseISODate(l.start_date))} – ${formatLongDate(parseISODate(l.end_date))}`,
                      )
                      .join(', ') + '.'}
                {primary.note ? ` Note: ${primary.note}` : ''}
                {covering && primary.finalized_at
                  ? ` (locked ${formatLongDate(parseISODate(primary.finalized_at.slice(0, 10)))})`
                  : ''}
              </div>
            </div>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-white/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            >
              {partial ? 'Unlock all' : 'Unlock'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10">
          <span className="text-sm text-slate-500">
            Not locked — anyone can still edit these days.
          </span>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setLockOpen(true)}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            title={canEdit ? undefined : 'Only the Apar team can finalize a period'}
          >
            🔒 Lock this {label}
          </button>
        </div>
      )}

      <Modal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        title={`Lock this ${label}`}
      >
        <p className="text-sm text-slate-600">
          This marks the {label} as finalized, with a “follow this plan” banner
          everyone can see. You can unlock it again any time.
        </p>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Note (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Approved by Priya — good to go."
            className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLockOpen(false)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={doLock}
            disabled={create.isPending}
            className="btn-primary disabled:opacity-60"
          >
            {create.isPending ? 'Locking…' : `Lock this ${label}`}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={unlockOpen}
        title={`Unlock this ${label}?`}
        message="Everyone will be able to edit these days again, and the “Locked” banner will disappear."
        confirmLabel="Unlock"
        busy={del.isPending}
        onConfirm={doUnlock}
        onCancel={() => setUnlockOpen(false)}
      />
    </div>
  )
}
