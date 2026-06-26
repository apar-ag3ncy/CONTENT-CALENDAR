// Writes for categories, team members, the shared info note, and grid order.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'

// ---- Categories -------------------------------------------------------------

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cat: { name: string; color: string }) => {
      await addDoc(collection(db, 'categories'), {
        ...cat,
        created_at: new Date().toISOString(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: { name?: string; color?: string }
    }) => {
      await updateDoc(doc(db, 'categories', id), patch)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'categories', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

// ---- Team members -----------------------------------------------------------

export function useCreateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await addDoc(collection(db, 'team_members'), {
        name,
        created_at: new Date().toISOString(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateDoc(doc(db, 'team_members', id), { name })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  })
}

export function useDeleteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'team_members', id))
    },
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
    mutationFn: async (content: string) => {
      await setDoc(
        doc(db, 'app_info', 'main'),
        { content, updated_at: new Date().toISOString() },
        { merge: true },
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_info'] }),
  })
}

// ---- Grid order -------------------------------------------------------------

export function useReorderGrid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // One atomic batch renumbers every position — never half-applied.
      const batch = writeBatch(db)
      orderedIds.forEach((id, i) => {
        batch.update(doc(db, 'content_items', id), {
          grid_position: i + 1,
          updated_at: new Date().toISOString(),
        })
      })
      await batch.commit()
    },
    // Refetch on success AND error so the grid always snaps to the true
    // server order if a save fails partway.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['grid_items'] })
      qc.invalidateQueries({ queryKey: ['content_items'] })
      qc.invalidateQueries({ queryKey: ['day_items'] })
    },
  })
}
