import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  useCreateTeamUser,
  useDeleteTeamUser,
  useTeamUsers,
  useUpdateTeamUser,
} from '../hooks/useAccounts'
import { useAuth } from '../lib/auth'
import { humanError } from '../lib/errors'
import type { TeamUser } from '../types/database'

const inputCls =
  'min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-white/5'

/** A team login row. Passwords are write-only (hashed server-side) — you can
 *  set a new one, but never read the existing one. */
function TeamUserRow({
  user,
  isSelf,
  onSave,
  onDelete,
  saving,
}: {
  user: TeamUser
  isSelf: boolean
  onSave: (id: string, patch: { name: string; username: string; password?: string }) => void
  onDelete: (user: TeamUser) => void
  saving: boolean
}) {
  const [name, setName] = useState(user.name)
  const [username, setUsername] = useState(user.username)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    setName(user.name)
    setUsername(user.username)
  }, [user.name, user.username])

  const dirty = name !== user.name || username !== user.username || newPassword !== ''
  const valid = name.trim() !== '' && username.trim() !== ''

  return (
    <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 w-9 flex-none place-items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Name</span>
            <input className={`w-full ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Username</span>
            <input className={`w-full ${inputCls}`} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Set new password</span>
            <input
              className={`w-full ${inputCls}`}
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="leave blank to keep"
            />
          </label>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isSelf ? (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">You</span>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(user)}
          disabled={isSelf}
          title={isSelf ? "You can't remove your own account" : undefined}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
        >
          Remove
        </button>
        <button
          type="button"
          disabled={!dirty || !valid || saving}
          onClick={() => {
            onSave(user.id, {
              name: name.trim(),
              username: username.trim(),
              password: newPassword !== '' ? newPassword : undefined,
            })
            setNewPassword('')
          }}
          className="btn-primary ml-auto px-4 py-1.5 text-xs disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

export default function TeamView() {
  const session = useAuth()
  const usersQ = useTeamUsers()
  const createUser = useCreateTeamUser()
  const updateUser = useUpdateTeamUser()
  const deleteUser = useDeleteTeamUser()

  const users = usersQ.data ?? []
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [confirm, setConfirm] = useState<TeamUser | null>(null)

  function fail(e: unknown) {
    setError(humanError(e))
  }

  function add() {
    if (form.name.trim() === '' || form.username.trim() === '' || form.password === '') return
    setError(null)
    createUser.mutate(
      { name: form.name.trim(), username: form.username.trim(), password: form.password },
      { onSuccess: () => setForm({ name: '', username: '', password: '' }), onError: fail },
    )
  }

  return (
    <div className="space-y-5">
      <div className="glass-head">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">Apar Team</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Team accounts</h1>
        <p className="mt-1 text-sm text-white/70">
          Everyone on the Apar team gets their own login. Team members can edit every client&rsquo;s
          calendar and manage client passwords.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="glass-panel glass-amber space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Add a team member</h2>
          <p className="text-sm text-slate-500">They&rsquo;ll be able to sign in immediately.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            className={inputCls}
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className={inputCls}
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <input
            className={inputCls}
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <button
            type="button"
            onClick={add}
            disabled={
              createUser.isPending ||
              form.name.trim() === '' ||
              form.username.trim() === '' ||
              form.password === ''
            }
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
          >
            {createUser.isPending ? 'Creating…' : '+ Create'}
          </button>
        </div>
      </section>

      <section className="glass-panel glass-neutral space-y-3 p-5">
        <h2 className="text-lg font-bold text-slate-900">All team members</h2>
        {usersQ.isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <TeamUserRow
                key={u.id}
                user={u}
                isSelf={session?.userId === u.id}
                saving={updateUser.isPending}
                onSave={(id, patch) => {
                  setError(null)
                  updateUser.mutate({ id, patch }, { onError: fail })
                }}
                onDelete={(user) => setConfirm(user)}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title="Remove this team member?"
        message={`“${confirm?.name}” will no longer be able to sign in. Their login is removed immediately.`}
        confirmLabel="Remove"
        busy={deleteUser.isPending}
        onConfirm={() => {
          if (!confirm) return
          deleteUser.mutate(confirm.id, {
            onSuccess: () => setConfirm(null),
            onError: (e) => {
              setConfirm(null)
              fail(e)
            },
          })
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
