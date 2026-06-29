// Writes for categories, team members, the shared info note, and grid order
// (via the MongoDB API).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

// ---- Categories -------------------------------------------------------------

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cat: { name: string; color: string }) => api.createCategory(cat),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      api.updateCategory(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

// ---- Team members -----------------------------------------------------------

export function useCreateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.createTeamMember(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateTeamMember(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  })
}

export function useDeleteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTeamMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      // assigned_to may reference this member — refresh content too.
      qc.invalidateQueries({ queryKey: ['content_items'] })
      qc.invalidateQueries({ queryKey: ['day_items'] })
    },
  })
}

// ---- Shared info note -------------------------------------------------------

export function useUpsertAppInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.upsertAppInfo(content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_info'] }),
  })
}

// ---- Grid order -------------------------------------------------------------

export function useReorderGrid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderGrid(orderedIds),
    // Refetch on success AND error so the grid always snaps to the true
    // server order if a save fails partway.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['grid_items'] })
      qc.invalidateQueries({ queryKey: ['content_items'] })
      qc.invalidateQueries({ queryKey: ['day_items'] })
    },
  })
}
