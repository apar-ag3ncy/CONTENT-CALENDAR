// Finalize (lock) and unlock a period. Under the no-login model these are
// advisory — the banner tells everyone to follow the plan; the DB doesn't block
// edits. Anyone can lock or unlock.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, doc, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { LockScope } from '../types/database'

export function useCreateLock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lock: {
      scope: LockScope
      start_date: string
      end_date: string
      note: string | null
    }) => {
      await addDoc(collection(db, 'period_locks'), {
        scope: lock.scope,
        start_date: lock.start_date,
        end_date: lock.end_date,
        note: lock.note,
        finalized_by: null,
        finalized_at: new Date().toISOString(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['period_locks'] }),
  })
}

export function useDeleteLock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'period_locks', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['period_locks'] }),
  })
}
