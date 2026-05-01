/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7e191b',     // Rojo principal
          secondary: '#b38e5d',   // Dorado
          tertiary: '#2e739a',    // Azul ballena
          gold: {
            DEFAULT: '#b38e5d',
            light: '#d4b483',
            dark: '#8c6d44',
          },
          maroon: {
            DEFAULT: '#7e191b',
            light: '#a62d2f',
            dark: '#5a1213',
          },
          blue: {
            DEFAULT: '#2e739a',
            light: '#348cb2',
            dark: '#144e73',
          },
          purple: {
            DEFAULT: '#581c87',
            light: '#7e22ce',
            dark: '#3b0764',
          },
          cream: {
            DEFAULT: '#F8F7F2',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
