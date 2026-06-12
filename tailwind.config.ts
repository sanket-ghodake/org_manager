import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx,css}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          portal: 'var(--bg-portal)',
        },
        surface: {
          card: 'var(--surface-card)',
        },
        text: {
          primary: 'var(--text-primary)',
        },
        brand: {
          accent: 'var(--brand-accent)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
