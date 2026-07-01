// Client review block shown under a piece of content: the current approval
// state, Approve / Request-changes buttons, and an expandable comment thread.
// Visible to both team and client when a backend is connected.
import { useState } from 'react'
import type { ApprovalState, ContentItem } from '../types/database'
import { isApiConfigured } from '../lib/api'
import { useAddComment, useComments, useSetApproval } from '../hooks/useReview'
import { humanError } from '../lib/errors'

const APPROVAL_META: Record<ApprovalState, { label: string; cls: string }> = {
  pending: { label: 'Awaiting review', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  approved: { label: '✓ Approved', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  changes_requested: { label: '↻ Changes requested', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
}

export function ApprovalPill({ state }: { state: ApprovalState }) {
  const m = APPROVAL_META[state] ?? APPROVAL_META.pending
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${m.cls}`}>
      {m.label}
    </span>
  )
}

function CommentThread({ itemId }: { itemId: string }) {
  const commentsQ = useComments(itemId)
  const addComment = useAddComment(itemId)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const comments = commentsQ.data ?? []

  function send() {
    const body = draft.trim()
    if (!body) return
    setErr(null)
    addComment.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: (e) => setErr(humanError(e)),
    })
  }

  return (
    <div className="mt-3 space-y-2">
      {commentsQ.isLoading ? (
        <p className="text-xs text-slate-400">Loading discussion…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400">No comments yet. Start the conversation below.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {c.author_name || 'Someone'}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    c.author_kind === 'team'
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {c.author_kind === 'team' ? 'Apar' : 'Client'}
                </span>
                <span className="ml-auto text-[10px] text-slate-400">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
          }}
          rows={2}
          placeholder="Add a comment… (⌘/Ctrl+Enter to send)"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={send}
          disabled={draft.trim() === '' || addComment.isPending}
          className="btn-primary flex-none px-3 py-2 text-sm disabled:opacity-40"
        >
          {addComment.isPending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export function ReviewBar({ item }: { item: ContentItem }) {
  const [open, setOpen] = useState(false)
  const setApproval = useSetApproval()
  const [err, setErr] = useState<string | null>(null)

  // No review workflow without a backend (demo mode is read-only sample data).
  if (!isApiConfigured) return null

  const setState = (state: ApprovalState) => {
    setErr(null)
    setApproval.mutate({ id: item.id, state }, { onError: (e) => setErr(humanError(e)) })
  }
  const busy = setApproval.isPending

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Client review</span>
        <ApprovalPill state={item.approval_state} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setState('approved')}
            disabled={busy || item.approval_state === 'approved'}
            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40 dark:bg-transparent"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setState('changes_requested')}
            disabled={busy || item.approval_state === 'changes_requested'}
            className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-40 dark:bg-transparent"
          >
            Request changes
          </button>
          {item.approval_state !== 'pending' ? (
            <button
              type="button"
              onClick={() => setState('pending')}
              disabled={busy}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {item.approval_updated_by ? (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Last set by {item.approval_updated_by}
        </p>
      ) : null}
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        💬 {open ? 'Hide discussion' : 'Discussion'}
      </button>
      {open ? <CommentThread itemId={item.id} /> : null}
    </div>
  )
}
