// Finalize (lock) and unlock a period (via the MongoDB API). Under the no-login
// model these are advisory — the banner tells everyone to follow the plan; the
// DB doesn't block edits. Anyone can lock or unlock.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { LockScope } from '../types/database'

export function useCreateLock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lock: { scope: LockScope; start_date: string; end_date: string; note: string | null }) =>
      api.createLock(lock),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['period_locks'] }),
  })
}

export function useDeleteLock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteLock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['period_locks'] }),
  })
}
