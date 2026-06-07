import type { TaxConfig } from './config';

/** Colorado flat tax on federal taxable income, less CO subtractions (SS for 65+, pension/annuity). */
export function coloradoTax(
  fedTaxableIncome: number,
  ssTaxedFederally: number,
  primaryAge: number,
  spouseAge: number,
  pensionSubtractionAmount: number,
  cfg: TaxConfig,
): number {
  const { flatRate, ssSubtractionAge, pensionSubtraction65, pensionSubtraction55 } = cfg.colorado;

  const ssSub = primaryAge >= ssSubtractionAge || spouseAge >= ssSubtractionAge ? ssTaxedFederally : 0;

  const cap = (age: number): number => (age >= 65 ? pensionSubtraction65 : age >= 55 ? pensionSubtraction55 : 0);
  const pensionSub = Math.min(Math.max(0, pensionSubtractionAmount), cap(primaryAge) + cap(spouseAge));

  const coTaxable = Math.max(0, fedTaxableIncome - ssSub - pensionSub);
  return coTaxable * flatRate;
}
