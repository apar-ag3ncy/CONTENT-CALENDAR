// Create / edit / remove content items + save day notes (via the MongoDB API).
// On success we invalidate the calendar and day queries so every view refreshes.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type NewContentItem } from '../lib/api'
import type { ContentItem } from '../types/database'

export type { NewContentItem }

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
    mutationFn: (item: NewContentItem): Promise<ContentItem> => api.createItem(item),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateContent()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ContentItem> }): Promise<ContentItem> =>
      api.updateItem(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateContent()
  return useMutation({
    mutationFn: ({ id, mediaPaths }: { id: string; mediaPaths?: string[] }): Promise<void> =>
      api.deleteItem(id, mediaPaths),
    onSuccess: invalidate,
  })
}

export function useUpsertDayNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, note }: { date: string; note: string }) => api.upsertDayNote(date, note),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['day_note', vars.date] })
    },
  })
}
