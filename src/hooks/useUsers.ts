// Admin-only user management (list / create / update / delete) via the API.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiConfigured, type Role } from '../lib/api'

export function useUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.users(),
    enabled: enabled && isApiConfigured,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (u: { email: string; name: string; password: string; role: Role }) => api.createUser(u),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; role?: Role; password?: string } }) =>
      api.updateUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
