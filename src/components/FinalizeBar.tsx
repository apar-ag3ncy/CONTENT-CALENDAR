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
  const covering = locks.find(
    (l) => l.start_date <= startISO && l.end_date >= endISO,
  )
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

  function doUnlock() {
    if (!covering) return
    del.mutate(covering.id, {
      onSuccess: () => setUnlockOpen(false),
      onError: (e) => {
        setUnlockOpen(false)
        setError(humanError(e))
      },
    })
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {covering ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-start gap-3 text-sm">
            <span className="text-lg" aria-hidden>
              ✅
            </span>
            <div>
              <div className="font-bold text-green-800">
                Locked — follow this plan
              </div>
              <div className="text-green-700">
                Please follow these days as planned.
                {covering.note ? ` Note: ${covering.note}` : ''}
                {covering.finalized_at
                  ? ` (locked ${formatLongDate(parseISODate(covering.finalized_at.slice(0, 10)))})`
                  : ''}
              </div>
            </div>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="rounded-xl border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
            >
              Unlock
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-sm text-slate-500">
            Not locked — anyone can still edit these days.
          </span>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setLockOpen(true)}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            title={canEdit ? undefined : 'Connect Supabase to lock periods'}
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
