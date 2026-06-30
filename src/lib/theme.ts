// Light/dark theme. The `dark` class on <html> is set pre-paint by the inline
// script in index.html (default dark); this hook reads & toggles it, persisting
// the choice to localStorage.
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* storage may be unavailable */
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => currentTheme())

  // Re-sync once mounted in case the pre-paint script and React disagree.
  useEffect(() => setThemeState(currentTheme()), [])

  const setTheme = (t: Theme) => {
    applyTheme(t)
    setThemeState(t)
  }
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return { theme, toggle, setTheme }
}
