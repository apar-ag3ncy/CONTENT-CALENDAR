// Reads for the Categories & Info page and the Overview feed.
import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import type { AppInfo, ContentItem, TeamMember } from '../types/database'

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    enabled: isFirebaseConfigured,
    queryFn: async (): Promise<TeamMember[]> => {
      const snap = await getDocs(collection(db, 'team_members'))
      const members = snap.docs.map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) } as TeamMember),
      )
      members.sort((a, b) => {
        const an = a.name ?? ''
        const bn = b.name ?? ''
        if (an !== bn) return an < bn ? -1 : 1
        return 0
      })
      return members
    },
  })
}

export function useAppInfo() {
  return useQuery({
    queryKey: ['app_info'],
    enabled: isFirebaseConfigured,
    queryFn: async (): Promise<AppInfo | null> => {
      const snap = await getDoc(doc(db, 'app_info', 'main'))
      return snap.exists()
        ? ({ id: 'main', ...(snap.data() as Record<string, unknown>) } as AppInfo)
        : null
    },
  })
}

/** The Overview feed = all posts + reels, in feed order. */
export function useGridItems() {
  return useQuery({
    queryKey: ['grid_items'],
    enabled: isFirebaseConfigured,
    queryFn: async (): Promise<ContentItem[]> => {
      const snap = await getDocs(collection(db, 'content_items'))
      const items = snap.docs
        .map(
          (d) =>
            ({ id: d.id, ...(d.data() as Record<string, unknown>) } as ContentItem),
        )
        .filter((it) => it.type === 'post' || it.type === 'reel')
      // grid_position asc (nulls last), then date asc.
      items.sort((a, b) => {
        const ag = a.grid_position
        const bg = b.grid_position
        if (ag !== bg) {
          if (ag == null) return 1
          if (bg == null) return -1
          return ag - bg
        }
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        return 0
      })
      return items
    },
  })
}
