import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neural-dark': '#0a0a0f',
        'neural-darker': '#050508',
        'neural-purple': '#a855f7',
        'neural-pink': '#ec4899',
        'neural-blue': '#3b82f6',
      }
    },
  },
  plugins: [],
} satisfies Config
