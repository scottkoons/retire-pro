import type { TaxConfig } from './config';

/** Federally taxable portion of Social Security (MFJ). VA disability already excluded by caller.
 *  provisional = otherAGI + taxExemptInterest + 0.5*ssGross. Thresholds are statutorily fixed. */
export function socialSecurityTaxable(
  ssGross: number,
  otherAGI: number,
  taxExemptInterest: number,
  cfg: TaxConfig,
): number {
  if (ssGross <= 0) return 0;
  const { tier1, tier2, maxTaxablePct, tier1Pct } = cfg.ssProvisional;
  const provisional = otherAGI + taxExemptInterest + 0.5 * ssGross;

  if (provisional <= tier1) return 0;

  if (provisional <= tier2) {
    const taxable = tier1Pct * (provisional - tier1);
    return Math.min(taxable, tier1Pct * ssGross);
  }

  const lower = tier1Pct * Math.min(provisional - tier1, tier2 - tier1);
  const upper = maxTaxablePct * (provisional - tier2);
  return Math.min(lower + upper, maxTaxablePct * ssGross);
}
