/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
        // Shading for festivals / holidays / special days.
        special: '#FBDDD4',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
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
