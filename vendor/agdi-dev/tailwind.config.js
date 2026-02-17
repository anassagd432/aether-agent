/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Agdi Brand Palette — Cyan + Gold
        'agdi-deep': '#0a0a0f',
        'agdi-surface': '#141420',
        'agdi-cyan': '#22d3ee',
        'agdi-cyan-glow': '#67e8f9',
        'agdi-cyan': '#22D3EE',
        'agdi-cyan-glow': '#67E8F9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        tech: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(34, 211, 238, 0.4)',
        'neon-cyan-alt': '0 0 20px rgba(34, 211, 238, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
