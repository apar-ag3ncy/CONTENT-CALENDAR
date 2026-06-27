import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useCategories } from '../hooks/useReferenceData'
import { useTeamMembers, useAppInfo } from '../hooks/useAdminData'
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateTeamMember,
  useUpdateTeamMember,
  useDeleteTeamMember,
  useUpsertAppInfo,
} from '../hooks/useAdminMutations'
import { isFirebaseConfigured } from '../lib/firebase'
import { humanError } from '../lib/errors'
import type { Category, TeamMember } from '../types/database'

const DEFAULT_COLOR = '#D62E14'

function CategoryRow({
  category,
  canEdit,
  onSave,
  onDelete,
}: {
  category: Category
  canEdit: boolean
  onSave: (id: string, patch: { name: string; color: string }) => void
  onDelete: (category: Category) => void
}) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  // Resync when the underlying row changes (e.g. after a refetch).
  useEffect(() => {
    setName(category.name)
    setColor(category.color)
  }, [category.name, category.color])

  const dirty = name !== category.name || color !== category.color

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2">
      <input
        type="color"
        value={color}
        disabled={!canEdit}
        onChange={(e) => setColor(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-slate-200 disabled:opacity-50"
        aria-label={`Colour for ${category.name}`}
      />
      <input
        value={name}
        disabled={!canEdit}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
        aria-label="Category name"
      />
      <button
        type="button"
        disabled={!canEdit || !dirty || name.trim() === ''}
        onClick={() => onSave(category.id, { name: name.trim(), color })}
        className="btn-primary px-3 py-2 text-sm disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => onDelete(category)}
        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

function TeamMemberRow({
  member,
  canEdit,
  onSave,
  onDelete,
}: {
  member: TeamMember
  canEdit: boolean
  onSave: (id: string, name: string) => void
  onDelete: (member: TeamMember) => void
}) {
  const [name, setName] = useState(member.name)
  useEffect(() => {
    setName(member.name)
  }, [member.name])
  const dirty = name !== member.name

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
      <span aria-hidden>👤</span>
      <input
        value={name}
        disabled={!canEdit}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
        aria-label="Member name"
      />
      <button
        type="button"
        disabled={!canEdit || !dirty || name.trim() === ''}
        onClick={() => onSave(member.id, name.trim())}
        className="btn-primary px-3 py-2 text-sm disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => onDelete(member)}
        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  )
}

export default function SettingsView() {
  const canEdit = isFirebaseConfigured
  const { hash } = useLocation()

  // Scroll to a section when linked via /settings#info etc.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])

  const categoriesQ = useCategories()
  const teamQ = useTeamMembers()
  const infoQ = useAppInfo()

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const createMember = useCreateTeamMember()
  const updateMember = useUpdateTeamMember()
  const deleteMember = useDeleteTeamMember()
  const upsertInfo = useUpsertAppInfo()

  const categories = categoriesQ.data ?? []
  const team = teamQ.data ?? []

  const [pageError, setPageError] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(DEFAULT_COLOR)
  const [newMember, setNewMember] = useState('')
  const [infoDraft, setInfoDraft] = useState('')
  const [confirm, setConfirm] = useState<
    | { kind: 'category'; id: string; label: string }
    | { kind: 'member'; id: string; label: string }
    | null
  >(null)

  useEffect(() => {
    setInfoDraft(infoQ.data?.content ?? '')
  }, [infoQ.data?.content])

  const infoDirty = infoDraft !== (infoQ.data?.content ?? '')

  function fail(e: unknown) {
    setPageError(humanError(e))
  }

  function addCategory() {
    if (newCatName.trim() === '') return
    setPageError(null)
    createCategory.mutate(
      { name: newCatName.trim(), color: newCatColor },
      {
        onSuccess: () => {
          setNewCatName('')
          setNewCatColor(DEFAULT_COLOR)
        },
        onError: fail,
      },
    )
  }

  function addMember() {
    if (newMember.trim() === '') return
    setPageError(null)
    createMember.mutate(newMember.trim(), {
      onSuccess: () => setNewMember(''),
      onError: fail,
    })
  }

  function confirmDelete() {
    if (!confirm) return
    const onDone = () => setConfirm(null)
    if (confirm.kind === 'category') {
      deleteCategory.mutate(confirm.id, {
        onSuccess: onDone,
        onError: (e) => {
          onDone()
          fail(e)
        },
      })
    } else {
      deleteMember.mutate(confirm.id, {
        onSuccess: onDone,
        onError: (e) => {
          onDone()
          fail(e)
        },
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass-head">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">Workspace</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Categories &amp; info</h1>
      </div>

      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Connect Firebase (add your <code>.env.local</code> keys) to manage
          categories, team members, and notes.
        </div>
      ) : null}
      {pageError ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {pageError}
        </p>
      ) : null}

      {/* Categories */}
      <section className="glass-panel glass-orange space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Categories</h2>
          <p className="text-sm text-slate-500">
            Colour-coded tags you can put on each piece of content.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
          <input
            type="color"
            value={newCatColor}
            disabled={!canEdit}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-slate-200 disabled:opacity-50"
            aria-label="New category colour"
          />
          <input
            value={newCatName}
            disabled={!canEdit}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!canEdit || newCatName.trim() === '' || createCategory.isPending}
            onClick={addCategory}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            + Add
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-slate-400">No categories yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                canEdit={canEdit}
                onSave={(id, patch) =>
                  updateCategory.mutate({ id, patch }, { onError: fail })
                }
                onDelete={(cat) =>
                  setConfirm({ kind: 'category', id: cat.id, label: cat.name })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Team members */}
      <section className="glass-panel glass-amber space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Team members</h2>
          <p className="text-sm text-slate-500">
            Names you can assign content to. (No accounts or passwords — just
            names.)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
          <input
            value={newMember}
            disabled={!canEdit}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="Add a person…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!canEdit || newMember.trim() === '' || createMember.isPending}
            onClick={addMember}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            + Add
          </button>
        </div>

        {team.length === 0 ? (
          <p className="text-sm text-slate-400">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {team.map((m) => (
              <TeamMemberRow
                key={m.id}
                member={m}
                canEdit={canEdit}
                onSave={(id, name) =>
                  updateMember.mutate({ id, name }, { onError: fail })
                }
                onDelete={(mem) =>
                  setConfirm({ kind: 'member', id: mem.id, label: mem.name })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Shared info note */}
      <section id="info" className="glass-panel glass-neutral space-y-3 p-5 scroll-mt-20">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Team info</h2>
          <p className="text-sm text-slate-500">
            A shared notice board — brand rules, links, reminders for everyone.
          </p>
        </div>
        <textarea
          value={infoDraft}
          disabled={!canEdit}
          onChange={(e) => setInfoDraft(e.target.value)}
          placeholder="e.g. Always tag @chhedas. Posting times: 11am & 7pm."
          className="min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 disabled:bg-slate-50"
        />
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!infoDirty || upsertInfo.isPending}
              onClick={() =>
                upsertInfo.mutate(infoDraft, { onError: fail })
              }
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              {upsertInfo.isPending ? 'Saving…' : 'Save info'}
            </button>
            {!infoDirty && infoQ.data ? (
              <span className="text-xs text-slate-500">Saved</span>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'category'
            ? 'Delete this category?'
            : 'Remove this person?'
        }
        message={
          confirm?.kind === 'category'
            ? `“${confirm?.label}” will be removed from the list. Content keeps its other details; it just loses this tag.`
            : `“${confirm?.label}” will be removed. Anything assigned to them becomes unassigned.`
        }
        confirmLabel={confirm?.kind === 'category' ? 'Delete' : 'Remove'}
        busy={deleteCategory.isPending || deleteMember.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
