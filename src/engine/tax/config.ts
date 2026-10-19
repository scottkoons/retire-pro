import * as T from './tables';
import type { Bracket, IrmaaTier } from './tables';
import type { Dollars, Rate } from '@/domain/types';

export interface TaxConfig {
  fedOrdinaryBrackets: Bracket[];
  stdDeductionBase: Dollars;
  stdDeductionAdditional65: Dollars;
  /** Extra per-person 65+ deduction for a window of tax years (perPerson 0 = none). */
  seniorDeduction: { perPerson: Dollars; phaseoutStart: Dollars; phaseoutRate: Rate; firstYear: number; lastYear: number };
  ltcg: { zeroRateUpTo: number; fifteenRateUpTo: number; rates: { zero: Rate; fifteen: Rate; twenty: Rate } };
  ssProvisional: { tier1: number; tier2: number; maxTaxablePct: Rate; tier1Pct: Rate; indexed: boolean };
  irmaaBasePremiumMonthly: Dollars;
  irmaaMedicalInflation: Rate;
  irmaaTiers: IrmaaTier[];
  niit: { rate: Rate; thresholdMFJ: number };
  colorado: {
    flatRate: Rate;
    ssSubtractionAge: number;
    ssEarlyAge: number;
    ssEarlyMagiLimitMFJ: Dollars;
    pensionSubtraction65: Dollars;
    pensionSubtraction55: Dollars;
  };
  rmdDivisors: Record<number, number>;
  rmdStartAge: number;
  indexBracketsToInflation: boolean;
  baseYear: number;
}

const SHARED = {
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
    ssEarlyAge: T.COLORADO.ssEarlyAge,
    ssEarlyMagiLimitMFJ: T.COLORADO.ssEarlyMagiLimitMFJ,
    pensionSubtraction65: T.COLORADO.pensionSubtraction65,
    pensionSubtraction55: T.COLORADO.pensionSubtraction55,
  },
  rmdDivisors: T.RMD_UNIFORM_LIFETIME,
  rmdStartAge: T.RMD_START_AGE,
  indexBracketsToInflation: true,
};

/** Current law, 2026 base year (today's dollars when the app runs in 2026). */
const DEFAULT_TAX_CONFIG: TaxConfig = {
  ...SHARED,
  fedOrdinaryBrackets: T.FED_ORDINARY_MFJ_2026.brackets,
  stdDeductionBase: T.STD_DEDUCTION_MFJ_2026.base,
  stdDeductionAdditional65: T.STD_DEDUCTION_MFJ_2026.additional65,
  seniorDeduction: { ...T.SENIOR_DEDUCTION_MFJ },
  ltcg: { zeroRateUpTo: T.LTCG_MFJ_2026.zeroRateUpTo, fifteenRateUpTo: T.LTCG_MFJ_2026.fifteenRateUpTo, rates: T.LTCG_MFJ_2026.rates },
  baseYear: 2026,
};

/** The 2025 tables WITHOUT the senior deduction: kept only so the regression
 *  harness's hand-checked worked example stays reproducible. */
export const DEFAULT_TAX_CONFIG_2025: TaxConfig = {
  ...SHARED,
  fedOrdinaryBrackets: T.FED_ORDINARY_MFJ_2025.brackets,
  stdDeductionBase: T.STD_DEDUCTION_MFJ_2025.base,
  stdDeductionAdditional65: T.STD_DEDUCTION_MFJ_2025.additional65,
  seniorDeduction: { ...T.SENIOR_DEDUCTION_MFJ, perPerson: 0 },
  ltcg: { zeroRateUpTo: T.LTCG_MFJ_2025.zeroRateUpTo, fifteenRateUpTo: T.LTCG_MFJ_2025.fifteenRateUpTo, rates: T.LTCG_MFJ_2025.rates },
  baseYear: 2025,
};

/** Shallow-merge user overrides onto the current-law baseline. */
export function resolveTaxConfig(overrides?: Partial<TaxConfig>): TaxConfig {
  return { ...DEFAULT_TAX_CONFIG, ...(overrides ?? {}) };
}

/** Scale a base-year value into the modeled year (or leave fixed if disabled / not indexed). */
export function indexed(value: number, cfg: TaxConfig, cpiFactor: number, isIndexed = true): number {
  return cfg.indexBracketsToInflation && isIndexed ? value * cpiFactor : value;
}
