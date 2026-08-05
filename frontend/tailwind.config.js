/** @type {import('tailwindcss').Config} */

// Fábrica del patrón `rgb(var(--x) / <alpha-value>)`: es lo que permite que
// `bg-primary/40` (opacidad) siga funcionando sobre un color que además
// cambia con el tema. La variable CSS solo guarda el triple R G B (ver
// styles.css); Tailwind inyecta el alfa en tiempo de generación de clase.
const themed = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core institutional palette (sober B2B dashboard). DEFAULT/hover/
        // subtle en cada color de abajo resuelven vía variable CSS (modo
        // oscuro real; las escalas numeradas (50-950) se quedan
        // en hex fijo — ver el comentario largo en styles.css sobre por qué.
        app: {
          bg: themed('--color-app-bg'),
          'bg-subtle': themed('--color-app-bg-subtle'),
          surface: themed('--color-app-surface'),
          border: themed('--color-app-border'),
          'border-subtle': themed('--color-app-border-subtle'),
          text: themed('--color-text-primary'),
          'text-secondary': themed('--color-text-secondary'),
          'text-muted': themed('--color-text-muted'),
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
          DEFAULT: themed('--color-primary'),
          hover: themed('--color-primary-hover'),
          subtle: themed('--color-primary-subtle'),
          muted: '#93c5fd',        // = 300; sin variante oscura dedicada, uso puntual
        },
        // Granate institucional (Universidad de Sevilla). Resuelve vía
        // variable CSS: en claro son los mismos valores de siempre, y en
        // oscuro sube para seguir siendo legible (ver styles.css).
        accent: {
          DEFAULT: themed('--color-accent'),
          hover: themed('--color-accent-hover'),
          subtle: themed('--color-accent-subtle'),
        },

        // Raíl lateral: grafito cálido y neutro. Es oscuro en los DOS temas a
        // propósito —ancla la marca contra el contenido claro— y conserva el
        // granate institucional como acento, no como una gran masa de fondo.
        rail: {
          DEFAULT: '#181617',
          subtle: '#242022',
          border: '#352E31',
          accent: '#D46C78',
          'accent-strong': '#8F2430',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
          DEFAULT: themed('--color-success'),
          subtle: themed('--color-success-subtle'),
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
          DEFAULT: themed('--color-warning'),
          subtle: themed('--color-warning-subtle'),
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
          DEFAULT: themed('--color-danger'),
          subtle: themed('--color-danger-subtle'),
        },

      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        // Solo para las superficies públicas y solo a >=28px: es una serif de
        // libro, y por debajo de ese tamaño se deshace en pantalla.
        display: ['EB Garamond', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      spacing: {
        base: '8px',
        xs: '4px',
        sm: '12px',
        md: '24px',
        lg: '48px',
        xl: '80px',
        gutter: '24px',
        margin: '32px',
      },
    },
  },
  plugins: [],
}
