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
          card: '#1E2734',
          border: '#1f2937',
          cyan: '#1F99E5',
          cyanDark: '#1a82c4',
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
