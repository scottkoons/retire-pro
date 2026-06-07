import type { TaxConfig } from './config';
import { indexed } from './config';

/** Progressive tax over MFJ ordinary brackets (thresholds inflation-scaled by cpiFactor). */
export function federalOrdinaryTax(taxableOrdinary: number, cfg: TaxConfig, cpiFactor = 1): number {
  if (taxableOrdinary <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const b of cfg.fedOrdinaryBrackets) {
    const ceil = b.upTo === null ? Infinity : indexed(b.upTo, cfg, cpiFactor);
    const slice = Math.min(taxableOrdinary, ceil) - prev;
    if (slice > 0) tax += slice * b.rate;
    if (taxableOrdinary <= ceil) break;
    prev = ceil;
  }
  return tax;
}

/** Marginal ordinary rate on the next dollar of ordinary income. */
export function marginalOrdinaryRate(taxableOrdinary: number, cfg: TaxConfig, cpiFactor = 1): number {
  for (const b of cfg.fedOrdinaryBrackets) {
    const ceil = b.upTo === null ? Infinity : indexed(b.upTo, cfg, cpiFactor);
    // Strict < so a dollar exactly at a bracket top is taxed at the NEXT bracket's rate.
    if (taxableOrdinary < ceil) return b.rate;
  }
  return cfg.fedOrdinaryBrackets[cfg.fedOrdinaryBrackets.length - 1].rate;
}

/** LTCG tax: gains stacked on top of ordinary taxable income, 0/15/20 by total taxable income. */
export function longTermCapGainsTax(ordinaryTaxable: number, gains: number, cfg: TaxConfig, cpiFactor = 1): number {
  if (gains <= 0) return 0;
  const zeroTop = indexed(cfg.ltcg.zeroRateUpTo, cfg, cpiFactor);
  const fifteenTop = indexed(cfg.ltcg.fifteenRateUpTo, cfg, cpiFactor);
  let pos = Math.max(0, ordinaryTaxable);
  let remaining = gains;
  let tax = 0;

  const inZero = Math.max(0, Math.min(pos + remaining, zeroTop) - pos);
  if (inZero > 0) {
    pos += inZero;
    remaining -= inZero;
  }
  const inFifteen = Math.max(0, Math.min(pos + remaining, fifteenTop) - pos);
  if (inFifteen > 0) {
    tax += inFifteen * cfg.ltcg.rates.fifteen;
    pos += inFifteen;
    remaining -= inFifteen;
  }
  if (remaining > 0) tax += remaining * cfg.ltcg.rates.twenty;
  return tax;
}
