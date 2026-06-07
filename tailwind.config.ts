import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        card: 'var(--surface-card)',
        'card-high': 'var(--surface-card-high)',
        input: 'var(--surface-input)',
        hover: 'var(--surface-hover)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        ink: 'var(--text-on-surface)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          press: 'var(--primary-press)',
          tint: 'var(--primary-tint)',
          on: 'var(--on-primary)',
        },
        success: { DEFAULT: 'var(--success)', tint: 'var(--success-tint)' },
        caution: { DEFAULT: 'var(--caution)', tint: 'var(--caution-tint)' },
        error: { DEFAULT: 'var(--error)', tint: 'var(--error-tint)' },
        tax: { DEFAULT: 'var(--tax)', tint: 'var(--tax-tint)' },
        'tax-free': { DEFAULT: 'var(--tax-free)', tint: 'var(--tax-free-tint)' },
        cat: {
          1: 'var(--cat-1)',
          2: 'var(--cat-2)',
          3: 'var(--cat-3)',
          4: 'var(--cat-4)',
          5: 'var(--cat-5)',
          6: 'var(--cat-6)',
        },
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      fontFamily: {
        head: ['"Hanken Grotesk Variable"', 'system-ui', 'sans-serif'],
        body: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'head-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'head-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'head-md': ['24px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      boxShadow: {
        overlay: '0 8px 24px rgba(0,0,0,0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
