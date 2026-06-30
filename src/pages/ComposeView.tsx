import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ContentForm, type ContentFormValues } from '../components/ContentForm'
import { Reveal } from '../components/Reveal'
import type { ContentType } from '../types/database'
import { useDayItems } from '../hooks/useDayData'
import { useCategories } from '../hooks/useReferenceData'
import { useTeamMembers } from '../hooks/useAdminData'
import { useCreateItem, useUpdateItem } from '../hooks/useMutations'
import { isApiConfigured } from '../lib/api'
import { useAuth } from '../lib/auth'
import { humanError } from '../lib/errors'
import {
  WEEKDAY_LONG,
  formatLongDate,
  isValidISODate,
  monthKey,
  parseISODate,
  toISODate,
  weekdayMonFirst,
} from '../lib/dates'

/**
 * Dedicated full-page composer for a Post / Reel / Story / Caption — replaces
 * the old popup. Driven by query params: ?date=YYYY-MM-DD with either
 * ?type=post (new) or ?edit=<id> (editing an existing item).
 */
export default function ComposeView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const dateParam = params.get('date')
  const dateISO = isValidISODate(dateParam ?? undefined)
    ? (dateParam as string)
    : toISODate(new Date())
  const editId = params.get('edit')
  const isEdit = Boolean(editId)
  const presetType = (params.get('type') as ContentType) || 'post'

  const d = parseISODate(dateISO)
  const dayOfWeek = WEEKDAY_LONG[weekdayMonFirst(d)]
  const backTo = `/month/${monthKey(d)}?d=${dateISO}`
  const { canEdit } = useAuth()

  const dayItemsQ = useDayItems(dateISO)
  const categoriesQ = useCategories()
  const teamQ = useTeamMembers()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()

  const [error, setError] = useState<string | null>(null)

  const items = dayItemsQ.data ?? []
  const editing = editId ? (items.find((i) => i.id === editId) ?? null) : null
  const saving = createItem.isPending || updateItem.isPending
  const loadingEdit = isEdit && dayItemsQ.isLoading

  function handleSubmit(values: ContentFormValues) {
    setError(null)
    if (editing) {
      updateItem.mutate(
        { id: editing.id, patch: values },
        {
          onSuccess: () => navigate(backTo),
          onError: (e) => setError(humanError(e)),
        },
      )
    } else {
      createItem.mutate(values, {
        onSuccess: () => navigate(backTo),
        onError: (e) => setError(humanError(e)),
      })
    }
  }

  if (isApiConfigured && !canEdit) {
    return (
      <div className="compose-canvas relative overflow-hidden rounded-[2rem] px-4 py-12 text-center text-white sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-flame-200/90">No access</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-cream">View-only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
          Managers can view the plan and update a post&rsquo;s status, but can&rsquo;t add or edit
          content. Ask an admin if you need changes made.
        </p>
        <Link
          to={backTo}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/25"
        >
          ← Back to the day
        </Link>
      </div>
    )
  }

  return (
    <div className="compose-canvas relative overflow-hidden rounded-[2rem] px-4 py-6 text-white sm:px-7 sm:py-8">
      {/* Decorative oversized watermark */}
      <span aria-hidden className="pointer-events-none absolute -right-6 -top-10 select-none font-serif text-[12rem] leading-none text-white/[0.06] sm:text-[16rem]">
        +
      </span>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/25"
        >
          <span aria-hidden>←</span> Back to the day
        </Link>
        <span className="rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
          {formatLongDate(d)}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-flame-200/90">
          {isEdit ? 'Edit content' : 'New content'}
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold leading-tight tracking-tight text-cream sm:text-[2.6rem]">
          {isEdit ? 'Edit this content' : 'Create something'}
        </h1>
      </div>

      {!isApiConfigured ? (
        <div className="mt-4 rounded-2xl border border-white/25 bg-black/15 px-4 py-2.5 text-sm text-white/90 backdrop-blur">
          ⚠️ The backend isn&rsquo;t connected yet — you can fill this in, but it
          won&rsquo;t save until <code className="font-mono">VITE_API_URL</code> is set (see server/).
        </div>
      ) : null}

      <Reveal>
        <div className="mt-6">
          {loadingEdit ? (
            <div className="pin-card py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : isEdit && !editing ? (
            <div className="pin-card py-10 text-center">
              <p className="text-sm text-slate-500">That item couldn&rsquo;t be found.</p>
              <Link to={backTo} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
                ← Back to the day
              </Link>
            </div>
          ) : (
            <ContentForm
              dateISO={dateISO}
              dayOfWeek={dayOfWeek}
              existing={editing}
              presetType={isEdit ? undefined : presetType}
              categories={categoriesQ.data ?? []}
              teamMembers={teamQ.data ?? []}
              saving={saving}
              errorMessage={error}
              onSubmit={handleSubmit}
              onCancel={() => navigate(backTo)}
            />
          )}
        </div>
      </Reveal>
    </div>
  )
}
