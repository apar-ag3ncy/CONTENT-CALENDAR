// Team-only account management: client workspaces (with viewable passwords) and
// Apar team logins. After client changes we also refresh the auth session's
// workspace list so the header switcher stays in sync.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { refreshClients } from '../lib/auth'
import type { Client, TeamUser } from '../types/database'

type AccountStatus = 'active' | 'disabled'

// ── Clients ──────────────────────────────────────────────────────────────────
export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: (): Promise<Client[]> => api.clients() })
}

type ClientColors = {
  brand_color?: string | null
  text_color?: string | null
  bg_color?: string | null
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: { name: string; username: string; password: string } & ClientColors) =>
      api.createClient(c),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      await refreshClients()
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: { name?: string; username?: string; password?: string; status?: AccountStatus } & ClientColors
    }) => api.updateClient(id, patch),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      await refreshClients()
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      await refreshClients()
    },
  })
}

// ── Team users ───────────────────────────────────────────────────────────────
export function useTeamUsers() {
  return useQuery({ queryKey: ['team_users'], queryFn: (): Promise<TeamUser[]> => api.teamUsers() })
}

export function useCreateTeamUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (u: { name: string; username: string; password: string }) => api.createTeamUser(u),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_users'] }),
  })
}

export function useUpdateTeamUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: { name?: string; username?: string; password?: string; status?: AccountStatus }
    }) => api.updateTeamUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_users'] }),
  })
}

export function useDeleteTeamUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTeamUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_users'] }),
  })
}
