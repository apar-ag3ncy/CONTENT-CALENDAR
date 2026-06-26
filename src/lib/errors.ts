/** Turn a Supabase/JS error into a plain, friendly message for the team. */
export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/permission|insufficient|unauthenticated|PERMISSION_DENIED/i.test(msg)) {
    return 'Couldn’t save — Firebase blocked this. Make sure the Firestore and Storage rules allow access (see the README).'
  }
  return msg || 'Something went wrong. Please try again.'
}
