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
      // Softer, larger geometry. Buttons land on 12px and cards on 18px, which
      // is the proportion the reference design uses; chips and inputs stay
      // tighter so dense grids do not turn into a row of lozenges.
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '18px',
        '2xl': '24px',
        full: '9999px',
      },
      fontFamily: {
        // Figtree for display, Inter for body — the same split the reference
        // site uses. Both are bundled via @fontsource so the CSP stays 'self'.
        head: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        body: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        // Intentionally NOT monospace: Scott dislikes the typewriter look, so every
        // `font-mono` site renders Inter; numeric columns stay aligned via `tabnum`.
        mono: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      // Display type is set LIGHT and TIGHT: weight 500 with negative tracking
      // that grows with size. Heavy headings are what made this read as a
      // generic dashboard rather than the reference look.
      fontSize: {
        'head-xl': ['48px', { lineHeight: '54px', letterSpacing: '-0.025em', fontWeight: '500' }],
        'head-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '500' }],
        'head-md': ['24px', { lineHeight: '30px', letterSpacing: '-0.015em', fontWeight: '500' }],
      },
      boxShadow: {
        // Theme-aware: light uses a soft wide lift, dark uses depth. A surface
        // gets a hairline border OR a shadow, never both.
        overlay: 'var(--shadow-overlay)',
        card: 'var(--shadow-card)',
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
