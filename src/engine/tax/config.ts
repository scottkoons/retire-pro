import * as T from './tables';
import type { Bracket, IrmaaTier } from './tables';
import type { Dollars, Rate } from '@/domain/types';

export interface TaxConfig {
  fedOrdinaryBrackets: Bracket[];
  stdDeductionBase: Dollars;
  stdDeductionAdditional65: Dollars;
  ltcg: { zeroRateUpTo: number; fifteenRateUpTo: number; rates: { zero: Rate; fifteen: Rate; twenty: Rate } };
  ssProvisional: { tier1: number; tier2: number; maxTaxablePct: Rate; tier1Pct: Rate; indexed: boolean };
  irmaaBasePremiumMonthly: Dollars;
  irmaaMedicalInflation: Rate;
  irmaaTiers: IrmaaTier[];
  niit: { rate: Rate; thresholdMFJ: number };
  colorado: { flatRate: Rate; ssSubtractionAge: number; pensionSubtraction65: Dollars; pensionSubtraction55: Dollars };
  rmdDivisors: Record<number, number>;
  rmdStartAge: number;
  indexBracketsToInflation: boolean;
  baseYear: number;
}

export const DEFAULT_TAX_CONFIG_2025: TaxConfig = {
  fedOrdinaryBrackets: T.FED_ORDINARY_MFJ_2025.brackets,
  stdDeductionBase: T.STD_DEDUCTION_MFJ_2025.base,
  stdDeductionAdditional65: T.STD_DEDUCTION_MFJ_2025.additional65,
  ltcg: { zeroRateUpTo: T.LTCG_MFJ_2025.zeroRateUpTo, fifteenRateUpTo: T.LTCG_MFJ_2025.fifteenRateUpTo, rates: T.LTCG_MFJ_2025.rates },
  ssProvisional: {
    tier1: T.SS_PROVISIONAL_MFJ.tier1,
    tier2: T.SS_PROVISIONAL_MFJ.tier2,
    maxTaxablePct: T.SS_PROVISIONAL_MFJ.maxTaxablePct,
    tier1Pct: T.SS_PROVISIONAL_MFJ.tier1Pct,
    indexed: false,
  },
  irmaaBasePremiumMonthly: T.IRMAA_PARTB_MFJ_2025.basePremiumMonthly,
  irmaaMedicalInflation: T.IRMAA_PARTB_MFJ_2025.medicalInflation,
  irmaaTiers: T.IRMAA_PARTB_MFJ_2025.tiers,
  niit: { rate: T.NIIT.rate, thresholdMFJ: T.NIIT.thresholdMFJ },
  colorado: {
    flatRate: T.COLORADO.flatRate,
    ssSubtractionAge: T.COLORADO.ssSubtractionAge,
    pensionSubtraction65: T.COLORADO.pensionSubtraction65,
    pensionSubtraction55: T.COLORADO.pensionSubtraction55,
  },
  rmdDivisors: T.RMD_UNIFORM_LIFETIME,
  rmdStartAge: T.RMD_START_AGE,
  indexBracketsToInflation: true,
  baseYear: 2025,
};

/** Shallow-merge user overrides onto the 2025 baseline. */
export function resolveTaxConfig(overrides?: Partial<TaxConfig>): TaxConfig {
  return { ...DEFAULT_TAX_CONFIG_2025, ...(overrides ?? {}) };
}

/** Scale a base-year value into the modeled year (or leave fixed if disabled / not indexed). */
export function indexed(value: number, cfg: TaxConfig, cpiFactor: number, isIndexed = true): number {
  return cfg.indexBracketsToInflation && isIndexed ? value * cpiFactor : value;
}
