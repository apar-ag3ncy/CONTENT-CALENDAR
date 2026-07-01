// Per-day notes thread: clients leave suggestions; the Apar team replies and
// acknowledges. Both sides read the same thread on the day page.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useDayComments(date: string) {
  return useQuery({
    queryKey: ['day_comments', date],
    queryFn: () => api.dayComments(date),
  })
}

export function useAddDayComment(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.addDayComment(date, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day_comments', date] }),
  })
}

export function useAckDayComment(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ack }: { id: string; ack: boolean }) => api.ackDayComment(id, ack),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day_comments', date] }),
  })
}

export function useDeleteDayComment(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteDayComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day_comments', date] }),
  })
}
