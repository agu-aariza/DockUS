/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core institutional palette (sober B2B dashboard)
        app: {
          bg: '#f8fafc',           // slate-50
          'bg-subtle': '#f1f5f9',  // slate-100
          surface: '#ffffff',
          border: '#e2e8f0',       // slate-200
          'border-subtle': '#f1f5f9',
        },
        primary: {
          DEFAULT: '#2563eb',      // blue-600
          hover: '#1d4ed8',        // blue-700
          subtle: '#eff6ff',       // blue-50
          muted: '#93c5fd',        // blue-300
        },
        accent: {
          DEFAULT: '#5b040d',      // brand wine — institutional accent only
          hover: '#7a1d20',
          subtle: '#fef2f2',
        },
        success: {
          DEFAULT: '#059669',      // emerald-600
          subtle: '#ecfdf5',       // emerald-50
        },
        warning: {
          DEFAULT: '#d97706',      // amber-600
          subtle: '#fffbeb',       // amber-50
        },
        danger: {
          DEFAULT: '#dc2626',      // red-600
          subtle: '#fee2e2',       // red-50
        },
        // Legacy aliases — kept for gradual migration of existing components.
        // Prefer using app.* / primary.* / accent.* / slate.* in new code.
        academic: {
          surface: '#f8fafc',
          'on-surface': '#0f172a',
          'on-surface-variant': '#64748b',
          outline: '#cbd5e1',
          'outline-variant': '#e2e8f0',
          primary: '#2563eb',
          'on-primary': '#ffffff',
          'primary-container': '#1d4ed8',
          secondary: '#475569',
          tertiary: '#5b040d',
          error: '#dc2626',
          'error-container': '#fee2e2',
          'surface-variant': '#e2e8f0',
        },
        brand: {
          primary: '#5b040d',
          secondary: '#64748b',
          tertiary: '#2563eb',
          blue: { DEFAULT: '#2563eb', light: '#dbeafe', dark: '#1d4ed8' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
