import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#09090b',     // Deep zinc-950
        card: '#121215',       // Primary surface
        cardHover: '#18181b',  // Secondary surface
        borderLine: '#27272a', // Zinc-800 1px border
        accentEmerald: '#10b981',
        accentAmber: '#f59e0b',
        accentRose: '#f43f5e',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
