// A tiny global toast store. Call `toast.success(...)` / `toast.error(...)` from
// anywhere; the <Toaster/> mounted at the root subscribes and renders them
// top-right. No dependencies, no context plumbing.

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
  duration: number
}

let counter = 0
let items: ToastItem[] = []
const listeners = new Set<(items: ToastItem[]) => void>()

function emit() {
  for (const l of listeners) l(items)
}

export function subscribe(fn: (items: ToastItem[]) => void) {
  listeners.add(fn)
  fn(items)
  return () => {
    listeners.delete(fn)
  }
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(kind: ToastKind, title: string, description?: string, duration = 3800) {
  const id = ++counter
  items = [...items, { id, kind, title, description, duration }]
  emit()
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export const toast = {
  success: (title: string, description?: string, duration?: number) =>
    push('success', title, description, duration),
  error: (title: string, description?: string, duration?: number) =>
    push('error', title, description, duration),
  info: (title: string, description?: string, duration?: number) =>
    push('info', title, description, duration),
}
