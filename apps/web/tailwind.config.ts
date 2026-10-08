import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07090f', 900: '#0c1018', 800: '#131a26', 700: '#1c2535', 600: '#283447', 500: '#3b4a63' },
        ember: { 300: '#ffb86b', 400: '#ff9f43', 500: '#ff7a1a', 600: '#e0600c', 700: '#b3480a' },
        elixir: { 400: '#c084fc', 500: '#a855f7', 600: '#9333ea' },
        gold: { 300: '#ffe08a', 400: '#ffd04d', 500: '#f5b800' },
        mint: { 400: '#34d399', 500: '#10b981' },
      },
      fontFamily: { display: ['"Sora"', 'ui-sans-serif', 'system-ui'], sans: ['"Inter"', 'ui-sans-serif', 'system-ui'], mono: ['"JetBrains Mono"', 'ui-monospace'] },
      boxShadow: { glow: '0 0 0 1px rgba(255,159,67,.25), 0 10px 40px -10px rgba(255,122,26,.45)', card: '0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px -15px rgba(0,0,0,.8)' },
      backgroundImage: { 'grid-faint': 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)' },
      keyframes: { pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } }, rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } } },
      animation: { pulseSoft: 'pulseSoft 2s ease-in-out infinite', rise: 'rise .25s ease-out' },
    },
  },
  plugins: [],
} satisfies Config;
