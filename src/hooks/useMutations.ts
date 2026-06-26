// Create / edit / remove content items + save day notes.
// On success we invalidate the calendar and day queries so every view refreshes.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import type { ContentItem } from '../types/database'

/** A content item ready to insert — server fills in id + timestamps. */
export type NewContentItem = Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>

function useInvalidateContent() {
  const qc = useQueryClient()
  return () => {
    // Prefix match invalidates every range/day query.
    qc.invalidateQueries({ queryKey: ['content_items'] })
    qc.invalidateQueries({ queryKey: ['day_items'] })
    qc.invalidateQueries({ queryKey: ['grid_items'] })
  }
}

export function useCreateItem() {
  const invalidate = useInvalidateContent()
  return useMutation({
    mutationFn: async (item: NewContentItem): Promise<ContentItem> => {
      const now = new Date().toISOString()
      const r = await addDoc(collection(db, 'content_items'), {
        ...item,
        created_at: now,
        updated_at: now,
      })
      return { id: r.id, ...item, created_at: now, updated_at: now } as ContentItem
    },
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateContent()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<ContentItem>
    }): Promise<void> => {
      await updateDoc(doc(db, 'content_items', id), {
        ...patch,
        updated_at: new Date().toISOString(),
      })
    },
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateContent()
  return useMutation({
    mutationFn: async ({
      id,
      mediaPaths,
    }: {
      id: string
      mediaPaths?: string[]
    }): Promise<void> => {
      await deleteDoc(doc(db, 'content_items', id))
      // Best-effort: remove uploaded files so they don't orphan in storage.
      for (const p of mediaPaths ?? []) {
        await deleteObject(ref(storage, p)).catch(() => {})
      }
    },
    onSuccess: invalidate,
  })
}

export function useUpsertDayNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      date,
      note,
    }: {
      date: string
      note: string
    }): Promise<void> => {
      // Doc id === date, so this is an idempotent upsert.
      await setDoc(
        doc(db, 'day_notes', date),
        { date, note, updated_at: new Date().toISOString() },
        { merge: true },
      )
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['day_note', vars.date] })
    },
  })
}
