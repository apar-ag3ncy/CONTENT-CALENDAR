/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand accent ramp — driven by CSS variables so each client workspace can
        // re-skin the whole app to its own colour (defaults to APAR orange-red,
        // set in index.css :root). Uses the rgb(var / <alpha>) form so opacity
        // utilities (bg-brand-500/20 etc.) keep working.
        brand: {
          DEFAULT: 'rgb(var(--brand-500) / <alpha-value>)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        // Warm orange — pairs with brand red for the red→orange "grainient" look.
        flame: {
          50: '#FFF4EC',
          100: '#FFE3CE',
          200: '#FCC79B',
          300: '#F9A463',
          400: '#F87F23', // light orange
          500: '#F16001', // gradient mid
          600: '#E85002', // branding orange
          700: '#C10801', // deep
          800: '#9A1106',
          900: '#7A1D0C',
        },
        // Warm neutrals from the palette.
        cream: '#F0DFCB',
        sand: '#D9C3AB',
        ink: '#21130F', // near-black warm brown
        // Shading for festivals / holidays / special days.
        special: '#FBDDD4',
        // Warm charcoal/espresso editorial palette (Grid Review) — on-brand neutral
        // that pairs with the orange accent and reads well in light AND dark mode.
        forest: {
          50: '#F7F4F2',
          100: '#EAE3DD',
          200: '#D4C7BC',
          300: '#B4A294',
          400: '#897463',
          500: '#5D4B3E',
          600: '#42342A', // primary panel
          700: '#2E241D', // dark band
          800: '#1F1813',
          900: '#150F0C',
          DEFAULT: '#2E241D',
        },
        // Soft champagne-gold hairline accent for the editorial frames.
        champagne: '#C9B68C',
      },
      fontFamily: {
        // San Francisco everywhere — Apple's system font (no web download).
        // `-apple-system`/`BlinkMacSystemFont` resolve to SF on macOS & iOS;
        // other platforms fall back to their native UI font.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        // Headings use the display optical size of San Francisco.
        serif: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
