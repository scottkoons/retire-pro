const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

/** $1,234,567 */
export function fmtUSD(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  return usd0.format(Math.round(n));
}

export function fmtUSD2(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return usd2.format(n);
}

/** $412k, $1.9M, $4.0M — compact axis/tile form. */
export function fmtUSDAbbrev(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** 0.074 -> "7.4%" */
export function fmtPct(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${(rate * 100).toFixed(digits)}%`;
}

/** 0.074 -> "7.4" (no % sign, for inline editing display) */
export function pctValue(rate: number, digits = 1): string {
  return (rate * 100).toFixed(digits);
}

export function fmtAge(a: number): string {
  return `${Math.round(a)}`;
}

/**
 * Fractional age, abbreviated per Scott's preference: 64.5 -> "64 yrs 6 mos",
 * 64 -> "64 yrs", 64.08 -> "64 yrs 1 mo". No "and", no comma.
 * Used everywhere a person's age is displayed (never for numeric inputs).
 */
export function fmtAgeYM(age: number): string {
  if (!Number.isFinite(age) || age < 0) return '—';
  const totalMonths = Math.round(age * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const y = `${years} ${years === 1 ? 'yr' : 'yrs'}`;
  if (months === 0) return y;
  return `${y} ${months} ${months === 1 ? 'mo' : 'mos'}`;
}

/** Duration from whole months: 147 -> "12 yrs 3 mos", 8 -> "8 mos". */
export function fmtMonthsYM(totalMonths: number): string {
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) return '0 mos';
  const m = Math.round(totalMonths);
  const years = Math.floor(m / 12);
  const months = m % 12;
  const yPart = years > 0 ? `${years} ${years === 1 ? 'yr' : 'yrs'}` : '';
  const mPart = months > 0 ? `${months} ${months === 1 ? 'mo' : 'mos'}` : '';
  return yPart && mPart ? `${yPart} ${mPart}` : yPart || mPart;
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
