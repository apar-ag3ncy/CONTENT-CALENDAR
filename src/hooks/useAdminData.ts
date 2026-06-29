// Reads for the Categories & Info page and the Overview feed.
// Uses the MongoDB API when configured, else the read-only demo seed.
import { useQuery } from '@tanstack/react-query'
import { DEMO_MODE, demoGridItems, DEMO_ITEMS } from '../lib/demoData'
import { api } from '../lib/api'
import type { AppInfo, ContentItem, TeamMember } from '../types/database'

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn: async (): Promise<TeamMember[]> => {
      if (DEMO_MODE) return []
      return api.teamMembers()
    },
  })
}

export function useAppInfo() {
  return useQuery({
    queryKey: ['app_info'],
    queryFn: async (): Promise<AppInfo | null> => {
      if (DEMO_MODE) return null
      return api.appInfo()
    },
  })
}

/** The Overview feed = all posts + reels, in feed order. */
export function useGridItems() {
  return useQuery({
    queryKey: ['grid_items'],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return demoGridItems()
      return api.grid()
    },
  })
}

/** Every content item across all days — used by Grid Review for the full overview. */
export function useAllContent() {
  return useQuery({
    queryKey: ['content_items'],
    queryFn: async (): Promise<ContentItem[]> => {
      if (DEMO_MODE) return DEMO_ITEMS
      return api.allContent()
    },
  })
}
