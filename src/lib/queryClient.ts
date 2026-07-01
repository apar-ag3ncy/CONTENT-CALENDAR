import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Always refetch when a page (re)mounts, so opening a day/grid shows the
      // current content immediately instead of a stale cached result that only
      // refreshes after a manual reload. Cached data still shows instantly while
      // the background refetch runs — no blank flash.
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
