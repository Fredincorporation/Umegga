/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mythic: {
          900: '#0b0f19',
          800: '#111827',
          700: '#1f293d',
          gold: '#eab308',
          amber: '#f59e0b',
          rune: '#38bdf8',
          aether: '#a855f7',
        }
      },
      fontFamily: {
        fantasy: ['Cinzel', 'Trajan Pro', 'Georgia', 'serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
