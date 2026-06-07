// Raw hex tokens for Recharts (SVG fills cannot reliably resolve CSS vars).
export const chart = {
  axis: '#64748b',
  grid: '#243043',
  tooltipBg: '#1b2638',
  tooltipBorder: '#33425c',
  bgBase: '#0d1420',
  primary: '#f97316',
  band: '#38bdf8', // Monte Carlo overlay — light sky blue, distinct from the orange projection
  marker: '#f97316',
  lumpSum: '#fbbf24',
  error: '#ef4444',
  success: '#22c55e',
  cat: {
    1: '#a78bfa',
    2: '#f472b6',
    3: '#34d399',
    4: '#fbbf24',
    5: '#60a5fa',
    6: '#f97316',
  } as Record<number, string>,
};

// Stable series identity: legend, bars, and stacked areas all read from here.
export const SERIES = {
  investment: { label: 'Investment Return', color: chart.cat[1], cat: 1 as const },
  va: { label: 'VA Benefits', color: chart.cat[2], cat: 2 as const },
  ssSelf: { label: 'Social Security', color: chart.cat[3], cat: 3 as const },
  ssSpouse: { label: 'Social Security (Spouse)', color: chart.cat[4], cat: 4 as const },
  other: { label: 'Other', color: chart.cat[5], cat: 5 as const },
} as const;
