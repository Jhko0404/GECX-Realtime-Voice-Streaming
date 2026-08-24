import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f8fafc',      // Light crisp slate-50
        card: '#ffffff',        // Pure white card
        cardHover: '#f1f5f9',   // Light slate-100
        borderLine: '#e2e8f0',  // Slate-200 border
        accentEmerald: '#10b981',
        accentIndigo: '#6366f1',
        accentSky: '#0ea5e9',
        accentAmber: '#f59e0b',
        accentRose: '#f43f5e',
        accentPurple: '#8b5cf6',
        accentCyan: '#06b6d4',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        'colorful-emerald': '0 8px 25px -4px rgba(16, 185, 129, 0.25)',
        'colorful-indigo': '0 8px 25px -4px rgba(99, 102, 241, 0.25)',
        'colorful-rose': '0 8px 25px -4px rgba(244, 63, 94, 0.25)',
      }
    },
  },
  plugins: [],
} satisfies Config;
