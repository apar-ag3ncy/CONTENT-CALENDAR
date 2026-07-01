// A per-day notes thread on the day page. Clients leave suggestions; the Apar
// team replies and ticks them off (acknowledge). Shown to both sides.
import { useState } from 'react'
import type { DayComment } from '../types/database'
import { isApiConfigured } from '../lib/api'
import { useIsTeam } from '../lib/auth'
import {
  useAckDayComment,
  useAddDayComment,
  useDayComments,
  useDeleteDayComment,
} from '../hooks/useDayComments'
import { humanError } from '../lib/errors'

function NoteBubble({
  c,
  isTeam,
  onAck,
  onDelete,
}: {
  c: DayComment
  isTeam: boolean
  onAck: (ack: boolean) => void
  onDelete: () => void
}) {
  const team = c.author_kind === 'team'
  return (
    <div
      className={`rounded-2xl border px-3.5 py-2.5 ${
        team
          ? 'border-brand-100 bg-brand-50/50 dark:border-brand-500/20 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.author_name || 'Someone'}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            team ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {team ? 'Apar' : 'Client'}
        </span>
        {c.acknowledged ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ Acknowledged{c.acknowledged_by ? ` · ${c.acknowledged_by}` : ''}
          </span>
        ) : null}
        <span className="ml-auto text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
      {isTeam ? (
        <div className="mt-1.5 flex items-center gap-3">
          {!team ? (
            <button
              type="button"
              onClick={() => onAck(!c.acknowledged)}
              className="text-[11px] font-semibold text-emerald-700 transition hover:underline"
            >
              {c.acknowledged ? 'Un-acknowledge' : '✓ Acknowledge'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] font-semibold text-slate-400 transition hover:text-red-500"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function DayNotesThread({ dateISO }: { dateISO: string }) {
  const isTeam = useIsTeam()
  const commentsQ = useDayComments(dateISO)
  const add = useAddDayComment(dateISO)
  const ack = useAckDayComment(dateISO)
  const del = useDeleteDayComment(dateISO)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (!isApiConfigured) return null
  const comments = commentsQ.data ?? []

  function send() {
    const body = draft.trim()
    if (!body) return
    setErr(null)
    add.mutate(body, { onSuccess: () => setDraft(''), onError: (e) => setErr(humanError(e)) })
  }

  return (
    <section className="card">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          💬
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Notes &amp; suggestions</h3>
          <p className="text-xs text-slate-500">
            {isTeam
              ? 'Client notes for this day — reply and tick off what you’ve actioned.'
              : 'Leave a note or suggestion for the Apar team about this day.'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {commentsQ.isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400 dark:bg-white/5">
            No notes yet.
          </p>
        ) : (
          comments.map((c) => (
            <NoteBubble
              key={c.id}
              c={c}
              isTeam={isTeam}
              onAck={(v) => ack.mutate({ id: c.id, ack: v })}
              onDelete={() => del.mutate(c.id)}
            />
          ))
        )}
      </div>

      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      <div className="mt-3 flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
          }}
          rows={2}
          placeholder={isTeam ? 'Reply to the client… (⌘/Ctrl+Enter to send)' : 'Add a note or suggestion…'}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={send}
          disabled={draft.trim() === '' || add.isPending}
          className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-40"
        >
          {add.isPending ? '…' : 'Send'}
        </button>
      </div>
    </section>
  )
}
