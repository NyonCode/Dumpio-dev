/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // Belt-and-suspenders: keep solid color swatches even if a color is ever
  // referenced indirectly. Component code should still use the static maps in
  // src/renderer/src/lib/colors.ts rather than building classes dynamically.
  safelist: [
    'bg-blue-500',
    'bg-red-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-gray-500',
    // Accent picker swatches (literal colors, independent of the accent palette)
    'bg-sky-500',
    'bg-violet-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-cyan-500'
  ],
  theme: {
    extend: {
      colors: {
        // The "blue" palette is the app accent. It is wired to CSS variables
        // (set per Appearance > Accent color) so existing `blue-*` utilities
        // recolor app-wide without dynamic classes. Defaults to blue via
        // :root in index.css. <alpha-value> keeps opacity modifiers working.
        blue: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
          950: 'rgb(var(--accent-950) / <alpha-value>)'
        },
        // Semantic surface/border/text tokens. These resolve to CSS variables
        // defined once per theme in index.css (:root = light, .dark = dark), so
        // components use a single class (e.g. `bg-panel`, `text-muted`) instead
        // of hand-pairing `bg-white dark:bg-slate-800`. <alpha-value> keeps
        // opacity modifiers (bg-panel/60, border-line/50) working.
        surface: 'rgb(var(--surface) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        // Accent as a semantic alias of the recolorable accent palette, so
        // shell/viewer can write `bg-accent` / `text-accent` directly.
        accent: {
          DEFAULT: 'rgb(var(--accent-500) / <alpha-value>)',
          fg: 'rgb(var(--accent-700) / <alpha-value>)',
          subtle: 'rgb(var(--accent-100) / <alpha-value>)'
        },
        // Data-syntax colors (see index.css). Independent of the accent palette
        // so value coloring in the JSON/var tree stays stable across accents.
        syntax: {
          key: 'rgb(var(--syntax-key) / <alpha-value>)',
          string: 'rgb(var(--syntax-string) / <alpha-value>)',
          number: 'rgb(var(--syntax-number) / <alpha-value>)',
          boolean: 'rgb(var(--syntax-boolean) / <alpha-value>)'
        },
        code: 'rgb(var(--code-bg) / <alpha-value>)',
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        sidebar: {
          light: '#f8fafc',
          dark: '#1e293b'
        },
        dump: {
          yellow: '#fbbf24',
          red: '#ef4444',
          blue: '#3b82f6',
          gray: '#6b7280',
          purple: '#8b5cf6',
          pink: '#ec4899',
          green: '#10b981'
        }
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Courier New',
          'monospace'
        ]
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.97) translateY(4px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        }
      },
      boxShadow: {
        glow: '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.15)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.15)',
        'glow-yellow': '0 0 20px rgba(251, 191, 36, 0.15)'
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem'
      }
    }
  },
  plugins: []
}
