/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./add/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        specter: {
          dark: '#0a0e17',
          darker: '#060810',
          card: '#111827',
          border: '#1f2937',
          cyan: '#00d4ff',
          cyanDark: '#0891b2',
          text: '#e5e7eb',
          textMuted: '#9ca3af',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444'
        }
      }
    }
  },
  plugins: [],
}
