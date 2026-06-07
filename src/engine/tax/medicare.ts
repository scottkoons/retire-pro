import type { TaxConfig } from './config';

/** Standard Part B base premium grown by medical inflation from the base year. Per beneficiary. */
export function partBBasePremiumMonthly(cfg: TaxConfig, yearsFromBase: number): number {
  return cfg.irmaaBasePremiumMonthly * Math.pow(1 + cfg.irmaaMedicalInflation, Math.max(0, yearsFromBase));
}

/** Monthly IRMAA surcharge per beneficiary given MAGI from 2 years prior (tiers inflate by medical inflation). */
export function irmaaPartBSurchargeMonthly(magiTwoYearsPrior: number, cfg: TaxConfig, yearsFromBase: number): number {
  const grow = Math.pow(1 + cfg.irmaaMedicalInflation, Math.max(0, yearsFromBase));
  for (const tier of cfg.irmaaTiers) {
    const ceil = tier.magiUpTo === null ? Infinity : tier.magiUpTo * grow;
    if (magiTwoYearsPrior <= ceil) return tier.monthlySurcharge * grow;
  }
  return cfg.irmaaTiers[cfg.irmaaTiers.length - 1].monthlySurcharge * grow;
}

/** Annual household IRMAA surcharge for `beneficiaries` people. Base premium handled separately. */
export function irmaaPartBSurcharge(magiTwoYearsPrior: number, cfg: TaxConfig, yearsFromBase: number, beneficiaries = 2): number {
  return irmaaPartBSurchargeMonthly(magiTwoYearsPrior, cfg, yearsFromBase) * 12 * beneficiaries;
}
