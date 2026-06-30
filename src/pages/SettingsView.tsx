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
import { isApiConfigured } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useUsers'
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

const userInputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-parchment dark:placeholder:text-parchment/40'

/** Admin-only: list the team, create members, change roles, remove. */
function UsersPanel() {
  const { user: me } = useAuth()
  const usersQ = useUsers(true)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const users = usersQ.data ?? []

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'manager'>('manager')
  const [err, setErr] = useState<string | null>(null)

  function add() {
    if (!email.trim() || !password) {
      setErr('Email and a temporary password are required.')
      return
    }
    setErr(null)
    createUser.mutate(
      { email: email.trim(), name: name.trim(), password, role },
      {
        onSuccess: () => {
          setEmail('')
          setName('')
          setPassword('')
          setRole('manager')
        },
        onError: (e) => setErr(humanError(e)),
      },
    )
  }

  return (
    <section id="users" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-night-850">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-parchment">Users &amp; access</h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:bg-white/10 dark:text-parchment/70">Admin</span>
      </div>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-parchment/55">
        Add the team. <strong>Admins</strong> edit everything; <strong>managers</strong> view the plan and change a post&rsquo;s status only.
      </p>

      <div className="mt-4 space-y-2">
        {usersQ.isLoading ? (
          <p className="text-sm text-slate-400 dark:text-parchment/45">Loading…</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-2.5 dark:border-white/10">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-600/30 dark:text-brand-200">
                {(u.name || u.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-parchment">
                  {u.name || u.email}
                  {u.id === me?.id ? ' (you)' : ''}
                </p>
                <p className="truncate text-xs text-slate-400 dark:text-parchment/50">{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => updateUser.mutate({ id: u.id, patch: { role: e.target.value as 'admin' | 'manager' } }, { onError: (er) => setErr(humanError(er)) })}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-parchment"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${u.email}?`)) deleteUser.mutate(u.id, { onError: (er) => setErr(humanError(er)) })
                }}
                disabled={u.id === me?.id}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-3 dark:border-white/10">
        <p className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-parchment/80">Add a team member</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={userInputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={userInputCls} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={userInputCls} placeholder="Temporary password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className={userInputCls} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'manager')}>
            <option value="manager">Manager — view + status</option>
            <option value="admin">Admin — full access</option>
          </select>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={createUser.isPending}
          className="mt-2 rounded-xl bg-gradient-to-br from-flame-500 to-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {createUser.isPending ? 'Adding…' : 'Add member'}
        </button>
        {err ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      </div>
    </section>
  )
}

export default function SettingsView() {
  const { canEdit, isAdmin } = useAuth()
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

      {!isApiConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Showing sample data — connect the backend (set <code>VITE_API_URL</code>)
          to manage categories, team members, and notes.
        </div>
      ) : !canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          You have view-only access. An admin manages categories, team and users.
        </div>
      ) : null}

      {isAdmin ? <UsersPanel /> : null}
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
