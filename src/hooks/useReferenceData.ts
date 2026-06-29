// Lookup data used by the content form (category dropdown).
// Uses the MongoDB API when configured, else the read-only demo seed.
import { useQuery } from '@tanstack/react-query'
import { DEMO_MODE } from '../lib/demoData'
import { api } from '../lib/api'
import type { Category } from '../types/database'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      if (DEMO_MODE) return []
      return api.categories()
    },
  })
}
