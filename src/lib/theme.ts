// Light/dark theme — class-based (`.dark` on <html>), persisted in localStorage.
// The initial class is set by an inline script in index.html (no-flash); this
// module powers the in-app toggle.
export type Theme = 'light' | 'dark'

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* private mode / storage disabled — fine */
  }
}

/** Flip the theme and return the new value. */
export function toggleTheme(): Theme {
  const next: Theme = isDark() ? 'light' : 'dark'
  applyTheme(next)
  return next
}
