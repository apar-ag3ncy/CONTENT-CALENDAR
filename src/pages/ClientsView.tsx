import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from '../hooks/useAccounts'
import { setActiveClient, useAuth } from '../lib/auth'
import { humanError } from '../lib/errors'
import type { Client } from '../types/database'

const inputCls =
  'min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-white/10 dark:bg-white/5'

/** A brand-colour swatch + native picker. `null` = use the Apar default. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-white/10">
      <label
        className="relative grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-md ring-1 ring-slate-200 dark:ring-white/10"
        style={{
          background: value || 'repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 4px,#fff 4px,#fff 8px)',
        }}
        title={value ?? 'Apar default'}
      >
        <input
          type="color"
          value={value || '#888888'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-500">{label}</span>
      {value ? (
        <button type="button" onClick={() => onChange(null)} title="Use Apar default" className="flex-none text-[11px] text-slate-400 hover:text-red-500">
          ✕
        </button>
      ) : null}
    </div>
  )
}

/** One editable client row: name, username, reveal/edit password, brand colours, status, delete. */
function ClientRow({
  client,
  isActive,
  onSave,
  onToggleStatus,
  onDelete,
  onView,
  saving,
}: {
  client: Client
  isActive: boolean
  onSave: (
    id: string,
    patch: {
      name: string
      username: string
      password?: string
      brand_color: string | null
      text_color: string | null
      bg_color: string | null
    },
  ) => void
  onToggleStatus: (client: Client) => void
  onDelete: (client: Client) => void
  onView: (client: Client) => void
  saving: boolean
}) {
  const [name, setName] = useState(client.name)
  const [username, setUsername] = useState(client.username)
  const [password, setPassword] = useState(client.password ?? '')
  const [reveal, setReveal] = useState(false)
  const [brand, setBrand] = useState(client.brand_color)
  const [text, setText] = useState(client.text_color)
  const [bg, setBg] = useState(client.bg_color)
  const undecryptable = client.password === null

  useEffect(() => {
    setName(client.name)
    setUsername(client.username)
    setPassword(client.password ?? '')
    setBrand(client.brand_color)
    setText(client.text_color)
    setBg(client.bg_color)
  }, [client.name, client.username, client.password, client.brand_color, client.text_color, client.bg_color])

  const dirty =
    name !== client.name ||
    username !== client.username ||
    password !== (client.password ?? '') ||
    brand !== client.brand_color ||
    text !== client.text_color ||
    bg !== client.bg_color
  const valid = name.trim() !== '' && username.trim() !== '' && password !== ''

  return (
    <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-9 w-9 flex-none place-items-center justify-center rounded-full text-sm font-bold ${
            client.status === 'active'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
              : 'bg-slate-200 text-slate-500'
          }`}
        >
          {client.name.charAt(0).toUpperCase()}
        </span>
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Workspace name</span>
            <input className={`w-full ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Login username</span>
            <input className={`w-full ${inputCls}`} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">Password</span>
            <div className="flex items-center gap-1">
              <input
                className={`w-full ${inputCls}`}
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                title={reveal ? 'Hide' : 'Show'}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                className="flex-none rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-white/10"
              >
                {reveal ? '🙈' : '👁'}
              </button>
            </div>
            {undecryptable ? (
              <span className="mt-1 block text-[10px] font-semibold text-amber-600">
                Couldn’t decrypt — set a new password to fix.
              </span>
            ) : null}
          </label>
        </div>
      </div>

      {/* Brand theme — recolours this client's whole workspace */}
      <div className="mt-3">
        <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">
          Brand theme (this client&rsquo;s app colours)
        </span>
        <div className="grid gap-2 sm:grid-cols-3">
          <ColorField label="Brand colour" value={brand} onChange={setBrand} />
          <ColorField label="Font colour" value={text} onChange={setText} />
          <ColorField label="Background" value={bg} onChange={setBg} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {client.status === 'disabled' ? (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">Disabled</span>
        ) : null}
        {isActive ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            Viewing now
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onView(client)}
          disabled={client.status !== 'active' || isActive}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10"
        >
          Open workspace
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(client)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10"
        >
          {client.status === 'active' ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(client)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={!dirty || !valid || saving}
          onClick={() =>
            onSave(client.id, {
              name: name.trim(),
              username: username.trim(),
              password: password !== client.password ? password : undefined,
              brand_color: brand,
              text_color: text,
              bg_color: bg,
            })
          }
          className="btn-primary ml-auto px-4 py-1.5 text-xs disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

export default function ClientsView() {
  const session = useAuth()
  const clientsQ = useClients()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const clients = clientsQ.data ?? []
  const [error, setError] = useState<string | null>(null)
  const blankForm = {
    name: '',
    username: '',
    password: '',
    brand_color: null as string | null,
    text_color: null as string | null,
    bg_color: null as string | null,
  }
  const [form, setForm] = useState(blankForm)
  const [confirm, setConfirm] = useState<Client | null>(null)

  function fail(e: unknown) {
    setError(humanError(e))
  }

  function add() {
    if (form.name.trim() === '' || form.username.trim() === '' || form.password === '') return
    setError(null)
    createClient.mutate(
      {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        brand_color: form.brand_color,
        text_color: form.text_color,
        bg_color: form.bg_color,
      },
      {
        onSuccess: () => setForm(blankForm),
        onError: fail,
      },
    )
  }

  return (
    <div className="space-y-5">
      <div className="glass-head">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">Apar Team</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Clients</h1>
        <p className="mt-1 text-sm text-white/70">
          Each client gets their own private calendar. Create an account, share the login, and
          they can review &amp; approve — without seeing anyone else&rsquo;s work.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Create a new client */}
      <section className="glass-panel glass-orange space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Add a client</h2>
          <p className="text-sm text-slate-500">
            Spins up a fresh, empty workspace they can log into right away.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            className={inputCls}
            placeholder="Workspace name (e.g. Acme Co)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className={inputCls}
            placeholder="Login username"
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
              createClient.isPending ||
              form.name.trim() === '' ||
              form.username.trim() === '' ||
              form.password === ''
            }
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
          >
            {createClient.isPending ? 'Creating…' : '+ Create'}
          </button>
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
            Brand theme (optional — sets this client&rsquo;s app colours)
          </span>
          <div className="grid gap-2 sm:grid-cols-3">
            <ColorField label="Brand colour" value={form.brand_color} onChange={(v) => setForm((f) => ({ ...f, brand_color: v }))} />
            <ColorField label="Font colour" value={form.text_color} onChange={(v) => setForm((f) => ({ ...f, text_color: v }))} />
            <ColorField label="Background" value={form.bg_color} onChange={(v) => setForm((f) => ({ ...f, bg_color: v }))} />
          </div>
        </div>
      </section>

      {/* Existing clients */}
      <section className="glass-panel glass-neutral space-y-3 p-5">
        <h2 className="text-lg font-bold text-slate-900">All clients</h2>
        {clientsQ.isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-400">No clients yet — add your first above.</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                isActive={session?.activeClientId === c.id}
                saving={updateClient.isPending}
                onSave={(id, patch) => {
                  setError(null)
                  updateClient.mutate({ id, patch }, { onError: fail })
                }}
                onToggleStatus={(client) =>
                  updateClient.mutate(
                    { id: client.id, patch: { status: client.status === 'active' ? 'disabled' : 'active' } },
                    { onError: fail },
                  )
                }
                onView={(client) => setActiveClient(client.id)}
                onDelete={(client) => setConfirm(client)}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title="Delete this client?"
        message={`“${confirm?.name}” and ALL of its calendar content, photos, and reviews will be permanently deleted. The login will stop working. This can’t be undone.`}
        confirmLabel="Delete client"
        busy={deleteClient.isPending}
        onConfirm={() => {
          if (!confirm) return
          deleteClient.mutate(confirm.id, {
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
