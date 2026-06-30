/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm near-black "night" palette for the dark theme (matches the
        // deployed calendar.apar.agency).
        night: {
          950: '#0f0b08', // page background
          900: '#150f0c',
          850: '#171210', // sidebar / cards
          800: '#1d1612', // raised cards
          700: '#241b16',
          600: '#2c211b', // borders / hover
        },
        parchment: '#d8cfc5', // warm cream body text on dark
        // APAR red — primary accent used across buttons, headers, highlights.
        brand: {
          DEFAULT: '#D62E14',
          50: '#FEF3F0',
          100: '#FBDDD4', // light red tint — special days
          200: '#F6BCAB',
          300: '#F0907A',
          400: '#E96343',
          500: '#E33A1E', // bright APAR red
          600: '#D62E14', // main accent (buttons)
          700: '#B32511',
          800: '#8F2012',
          900: '#751D13',
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
        // Deep bottle-green editorial palette (the "ZYRA" grid-review aesthetic).
        forest: {
          50: '#EEF3F0',
          100: '#D5E1DB',
          200: '#A9C0B5',
          300: '#7C9C8C',
          400: '#517763',
          500: '#315845',
          600: '#214034', // primary panel green
          700: '#1A3329',
          800: '#13261E',
          900: '#0D1B15',
          DEFAULT: '#214034',
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
