// Data for a single Day page: that day's content items and its day-level note.
import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import type { ContentItem, DayNote } from '../types/database'

export function useDayItems(dateISO: string) {
  return useQuery({
    queryKey: ['day_items', dateISO],
    enabled: isFirebaseConfigured,
    queryFn: async (): Promise<ContentItem[]> => {
      const snap = await getDocs(
        query(collection(db, 'content_items'), where('date', '==', dateISO)),
      )
      const items = snap.docs.map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) } as ContentItem),
      )
      // grid_position asc (nulls last), then created_at asc.
      items.sort((a, b) => {
        const ag = a.grid_position
        const bg = b.grid_position
        if (ag !== bg) {
          if (ag == null) return 1
          if (bg == null) return -1
          return ag - bg
        }
        const ac = a.created_at ?? ''
        const bc = b.created_at ?? ''
        if (ac !== bc) return ac < bc ? -1 : 1
        return 0
      })
      return items
    },
  })
}

export function useDayNote(dateISO: string) {
  return useQuery({
    queryKey: ['day_note', dateISO],
    enabled: isFirebaseConfigured,
    queryFn: async (): Promise<DayNote | null> => {
      const snap = await getDoc(doc(db, 'day_notes', dateISO))
      return snap.exists()
        ? ({ date: dateISO, ...(snap.data() as Record<string, unknown>) } as DayNote)
        : null
    },
  })
}
