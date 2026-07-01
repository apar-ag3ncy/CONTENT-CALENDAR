// Client review: per-item approval state + a comment thread. Both team and
// client sessions can approve/comment; the backend enforces who may do what.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ApprovalState } from '../types/database'

export function useComments(itemId: string, enabled = true) {
  return useQuery({
    queryKey: ['comments', itemId],
    queryFn: () => api.comments(itemId),
    enabled,
  })
}

export function useAddComment(itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.addComment(itemId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', itemId] }),
  })
}

export function useDeleteComment(itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(itemId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', itemId] }),
  })
}

/** Set a content item's approval state. Refreshes every view that shows it. */
export function useSetApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: ApprovalState }) =>
      api.setApproval(id, state),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content_items'] })
      qc.invalidateQueries({ queryKey: ['day_items'] })
      qc.invalidateQueries({ queryKey: ['grid_items'] })
    },
  })
}
