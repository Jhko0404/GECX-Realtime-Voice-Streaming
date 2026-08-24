import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        googleBlue: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#aecbfa',
          300: '#8ab4f8',
          400: '#669df6',
          500: '#4285f4',
          600: '#1a73e8', // Main Google Blue
          700: '#1967d2',
          800: '#185abc',
          900: '#174ea6',
        },
        googleRed: {
          50: '#fce8e6',
          100: '#fad2cf',
          500: '#ea4335',
          600: '#d93025',
          700: '#c5221f',
        },
        googleYellow: {
          50: '#fef7e0',
          100: '#feefc3',
          500: '#fbbc04',
          600: '#f9ab00',
          700: '#e37400',
        },
        googleGreen: {
          50: '#e6f4ea',
          100: '#ceead6',
          500: '#34a853',
          600: '#1e8e3e',
          700: '#188038',
          800: '#137333',
        },
        googleGrey: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b',
          700: '#5f6368',
          800: '#3c4043',
          900: '#202124',
        },
        surface: '#ffffff',
        surfaceContainer: '#f8fafd',
        surfaceVariant: '#f1f3f4',
        outline: '#dadce0',
        outlineVariant: '#e8eaed',
      },
      fontFamily: {
        sans: ['Google Sans', 'Roboto', 'Plus Jakarta Sans', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['Google Sans Code', 'JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
      boxShadow: {
        'google-1': '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'google-2': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        'google-3': '0 2px 6px 2px rgba(60,64,67,0.15), 0 1px 2px 0 rgba(60,64,67,0.3)',
        'google-soft': '0 1px 3px 0 rgba(60,64,67,0.08), 0 2px 6px 2px rgba(60,64,67,0.04)',
      }
    },
  },
  plugins: [],
} satisfies Config;

