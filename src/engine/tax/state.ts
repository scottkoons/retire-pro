import type { TaxConfig } from './config';

/** Colorado flat tax on federal taxable income, less the retirement subtractions
 *  (rules in tables.ts COLORADO). Household-level: the older spouse's age
 *  decides the Social Security rule, and each spouse 55+ adds a pension cap. */
export function coloradoTax(
  fedTaxableIncome: number,
  ssTaxedFederally: number,
  primaryAge: number,
  spouseAge: number,
  pensionSubtractionAmount: number,
  cfg: TaxConfig,
  /** Federal AGI + untaxed Social Security; only the 55-64 test reads it. */
  coModifiedAgi = 0,
): number {
  const { flatRate, ssSubtractionAge, ssEarlyAge, ssEarlyMagiLimitMFJ, pensionSubtraction65, pensionSubtraction55 } = cfg.colorado;
  const older = Math.max(primaryAge, spouseAge);

  let ssSub = 0;
  let capped = Math.max(0, pensionSubtractionAmount);
  if (older >= ssSubtractionAge || (older >= ssEarlyAge && coModifiedAgi <= ssEarlyMagiLimitMFJ)) ssSub = ssTaxedFederally;
  else if (older >= ssEarlyAge) capped += ssTaxedFederally; // shares the 55-64 pension cap

  const cap = (age: number): number => (age >= 65 ? pensionSubtraction65 : age >= 55 ? pensionSubtraction55 : 0);
  const pensionSub = Math.min(capped, cap(primaryAge) + cap(spouseAge));

  const coTaxable = Math.max(0, fedTaxableIncome - ssSub - pensionSub);
  return coTaxable * flatRate;
}
