/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // APAR orange-red (#EE3A24) — primary brand accent across the app.
        brand: {
          DEFAULT: '#EE3A24',
          50: '#FEF2EF',
          100: '#FBDCD5', // light tint — special days
          200: '#F8BAA9',
          300: '#F38C73',
          400: '#F15C40',
          500: '#EE3A24', // APAR orange-red
          600: '#DC2E18', // main accent (buttons)
          700: '#B82513',
          800: '#931E12',
          900: '#791C13',
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
        sans: [
          'Outfit',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}
