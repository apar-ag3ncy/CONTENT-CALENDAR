// Apply a client's brand colours to the whole app by overriding the CSS
// variables the Tailwind `brand` ramp + page chrome read from. Setting an inline
// style on <html> beats the :root defaults; clearing it falls back to APAR.
import type { BrandColors } from '../types/database'

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const n = Number.parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (c: number, target: number, t: number) => Math.round(c + (target - c) * t)
const toward = (rgb: [number, number, number], target: number, t: number): [number, number, number] => [
  mix(rgb[0], target, t),
  mix(rgb[1], target, t),
  mix(rgb[2], target, t),
]

/** Build a 50→900 ramp from one brand hex (500 = the hex, lighter up, darker down). */
function ramp(hex: string): Record<number, [number, number, number]> | null {
  const base = hexToRgb(hex)
  if (!base) return null
  return {
    50: toward(base, 255, 0.92),
    100: toward(base, 255, 0.84),
    200: toward(base, 255, 0.66),
    300: toward(base, 255, 0.45),
    400: toward(base, 255, 0.2),
    500: base,
    600: toward(base, 0, 0.12),
    700: toward(base, 0, 0.28),
    800: toward(base, 0, 0.44),
    900: toward(base, 0, 0.56),
  }
}

/** Apply (or, with null, clear) a client's brand theme on the document root. */
export function applyBrandTheme(colors: Partial<BrandColors> | null | undefined): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const r = colors?.brand_color ? ramp(colors.brand_color) : null

  for (const shade of SHADES) {
    if (r) root.style.setProperty(`--brand-${shade}`, r[shade].join(' '))
    else root.style.removeProperty(`--brand-${shade}`)
  }

  if (colors?.text_color) root.style.setProperty('--app-heading', colors.text_color)
  else root.style.removeProperty('--app-heading')

  if (colors?.bg_color) {
    const bg = hexToRgb(colors.bg_color)
    if (bg) {
      const tint = toward(bg, 255, 0.9) // lighten so cards/text stay readable
      root.style.setProperty('--app-bg', `rgb(${tint.join(' ')})`)
    }
  } else {
    root.style.removeProperty('--app-bg')
  }

  if (colors?.brand_color || colors?.text_color || colors?.bg_color) {
    root.setAttribute('data-themed', '')
  } else {
    root.removeAttribute('data-themed')
  }
}
