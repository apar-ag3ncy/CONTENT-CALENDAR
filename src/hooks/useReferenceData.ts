// Lookup data used by the content form (category dropdown).
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { DEMO_MODE } from '../lib/demoData'
import type { Category } from '../types/database'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      if (DEMO_MODE) return []
      const snap = await getDocs(collection(db, 'categories'))
      const categories = snap.docs.map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Category),
      )
      categories.sort((a, b) => {
        const an = a.name ?? ''
        const bn = b.name ?? ''
        if (an !== bn) return an < bn ? -1 : 1
        return 0
      })
      return categories
    },
  })
}
