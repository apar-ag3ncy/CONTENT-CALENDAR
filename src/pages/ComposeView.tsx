import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ContentForm, type ContentFormValues } from '../components/ContentForm'
import type { ContentType } from '../types/database'
import { useDayItems } from '../hooks/useDayData'
import { useCategories } from '../hooks/useReferenceData'
import { useTeamMembers } from '../hooks/useAdminData'
import { useCreateItem, useUpdateItem } from '../hooks/useMutations'
import { isFirebaseConfigured } from '../lib/firebase'
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

  return (
    <div className="space-y-5">
      {/* Grainient hero */}
      <div className="grainient overflow-hidden rounded-3xl px-6 py-7 text-white shadow-[0_18px_40px_-18px_rgba(138,31,12,0.6)] sm:px-9 sm:py-9">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
        >
          <span aria-hidden>←</span> Back to the day
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
          {isEdit ? 'Edit content' : 'New content'}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {isEdit ? 'Edit this content' : 'Create something'}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-white/85">
          {formatLongDate(d)}
        </p>
      </div>

      {!isFirebaseConfigured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          ⚠️ Firebase isn&rsquo;t connected yet — you can fill this in, but it
          won&rsquo;t save until the database is set up.
        </div>
      ) : null}

      {/* Form panel — padding matches ContentForm's sticky-footer bleed (-mx-5 -mb-4). */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200/80 bg-white px-5 pt-5 pb-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_14px_28px_-20px_rgba(16,24,40,0.16)]">
        {loadingEdit ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : isEdit && !editing ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">
              That item couldn&rsquo;t be found.
            </p>
            <Link
              to={backTo}
              className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline"
            >
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
    </div>
  )
}
