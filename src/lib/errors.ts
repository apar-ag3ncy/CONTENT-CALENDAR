/** Turn an API / JS error into a plain, friendly message for the team. */
export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Couldn’t reach the backend. Make sure the API server is running and VITE_API_URL is correct.'
  }
  if (/permission|insufficient|unauthorized|forbidden/i.test(msg)) {
    return 'Couldn’t save — the backend rejected this request.'
  }
  return msg || 'Something went wrong. Please try again.'
}
