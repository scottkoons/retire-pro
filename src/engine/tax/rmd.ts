import type { TaxConfig } from './config';

export function rmdDivisor(age: number, cfg: TaxConfig): number | null {
  return cfg.rmdDivisors[Math.floor(age)] ?? null;
}

/** Required Minimum Distribution for the year from the aggregate pre-tax balance.
 *  Returns 0 before rmdStartAge (73). Past the table end, distributes the full balance. */
export function rmd(age: number, priorYearEndPretaxBalance: number, cfg: TaxConfig): number {
  if (Math.floor(age) < cfg.rmdStartAge || priorYearEndPretaxBalance <= 0) return 0;
  const div = rmdDivisor(age, cfg);
  if (!div) return priorYearEndPretaxBalance;
  return priorYearEndPretaxBalance / div;
}
