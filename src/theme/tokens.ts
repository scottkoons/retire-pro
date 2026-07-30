// ============================================================================
// Raw hex tokens for Recharts (SVG fills cannot reliably resolve CSS vars).
//
// These are GETTERS, not constants, so they re-read the active theme at the
// moment a chart renders. That is what lets every chart component keep its
// plain `import { chart }` and still follow the theme: a store change
// re-renders the tree, the getters run again, and the SVG picks up the new
// colours. Freezing these into constants (e.g. `const { grid } = chart`) at
// module scope would break that — do not destructure at module level.
// ============================================================================

const isLight = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';

const pick = <T,>(light: T, dark: T): T => (isLight() ? light : dark);

/** Series palette, deepened in light mode so it holds up on a pale surface. */
const CAT_LIGHT: Record<number, string> = {
  1: '#7c5cd6',
  2: '#d14d86',
  3: '#0f9d6e',
  4: '#c07c06',
  5: '#3b7fd4',
  6: '#ea670c',
};
const CAT_DARK: Record<number, string> = {
  1: '#a78bfa',
  2: '#f472b6',
  3: '#34d399',
  4: '#fbbf24',
  5: '#60a5fa',
  6: '#f97316',
};

export const chart = {
  // Chrome: axes, gridlines, tooltip surface.
  get axis() {
    return pick('#8e9382', '#74746a');
  },
  get grid() {
    return pick('#e3e8d6', '#2a2a23');
  },
  get tooltipBg() {
    return pick('#ffffff', '#21211c');
  },
  get tooltipBorder() {
    return pick('#d5daca', '#3a3a30');
  },
  get bgBase() {
    return pick('#fbfcf7', '#12120f');
  },
  /** Full-strength label text drawn directly into SVG (mirrors --text-on-surface). */
  get ink() {
    return pick('#0e0e0b', '#f4f4ec');
  },

  // Data. Orange stays the projection colour in both themes.
  get primary() {
    return pick('#ea670c', '#f97316');
  },
  get marker() {
    return pick('#ea670c', '#f97316');
  },
  /** Monte Carlo overlay — deliberately distinct from the orange projection. */
  get band() {
    return pick('#2f8fd4', '#38bdf8');
  },
  get lumpSum() {
    return pick('#c07c06', '#fbbf24');
  },
  get error() {
    return pick('#b91c1c', '#f87171');
  },
  get success() {
    return pick('#15803d', '#34d399');
  },
  get cat(): Record<number, string> {
    return pick(CAT_LIGHT, CAT_DARK);
  },
};

// Stable series identity: legend, bars, and stacked areas all read from here.
// `color` is a getter for the same reason as above — a legend swatch and its
// chart series must never disagree after a theme switch.
export const SERIES = {
  investment: {
    label: 'Investment Return',
    cat: 1 as const,
    get color() {
      return chart.cat[1];
    },
  },
  va: {
    label: 'VA Benefits',
    cat: 2 as const,
    get color() {
      return chart.cat[2];
    },
  },
  ssSelf: {
    label: 'Social Security',
    cat: 3 as const,
    get color() {
      return chart.cat[3];
    },
  },
  ssSpouse: {
    label: 'Social Security (Spouse)',
    cat: 4 as const,
    get color() {
      return chart.cat[4];
    },
  },
  other: {
    label: 'Other',
    cat: 5 as const,
    get color() {
      return chart.cat[5];
    },
  },
};
