/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
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
      }
    }
  },
  plugins: []
}
