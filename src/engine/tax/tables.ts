// All dollar figures are 2025 base-year, MFJ. Callers scale indexed tables by cpiFactor.
import type { Dollars, Rate } from '@/domain/types';

export interface Bracket {
  upTo: number | null; // null => top open bracket
  rate: Rate;
}

export const FED_ORDINARY_MFJ_2025: { sourceYear: number; brackets: Bracket[] } = {
  sourceYear: 2025,
  brackets: [
    { upTo: 23_850, rate: 0.1 },
    { upTo: 96_950, rate: 0.12 },
    { upTo: 206_700, rate: 0.22 },
    { upTo: 394_600, rate: 0.24 },
    { upTo: 501_050, rate: 0.32 },
    { upTo: 751_600, rate: 0.35 },
    { upTo: null, rate: 0.37 },
  ],
};

export const STD_DEDUCTION_MFJ_2025 = {
  sourceYear: 2025,
  base: 30_000,
  additional65: 1_600, // per spouse age 65+
};

export const LTCG_MFJ_2025 = {
  sourceYear: 2025,
  zeroRateUpTo: 96_700,
  fifteenRateUpTo: 600_050,
  rates: { zero: 0, fifteen: 0.15, twenty: 0.2 },
};

export const SS_PROVISIONAL_MFJ = {
  sourceYear: 2025,
  tier1: 32_000,
  tier2: 44_000,
  maxTaxablePct: 0.85,
  tier1Pct: 0.5,
  indexed: false, // statutorily fixed
};

export interface IrmaaTier {
  magiUpTo: number | null;
  monthlySurcharge: Dollars;
}

export const IRMAA_PARTB_MFJ_2025 = {
  sourceYear: 2025,
  basePremiumMonthly: 185.0,
  medicalInflation: 0.045,
  tiers: [
    { magiUpTo: 212_000, monthlySurcharge: 0 },
    { magiUpTo: 266_000, monthlySurcharge: 74.0 },
    { magiUpTo: 334_000, monthlySurcharge: 185.0 },
    { magiUpTo: 400_000, monthlySurcharge: 295.9 },
    { magiUpTo: 750_000, monthlySurcharge: 406.9 },
    { magiUpTo: null, monthlySurcharge: 443.9 },
  ] as IrmaaTier[],
};

export const NIIT = { sourceYear: 2025, rate: 0.038, thresholdMFJ: 250_000, indexed: false };

export const COLORADO = {
  sourceYear: 2025,
  flatRate: 0.044,
  ssSubtractionAge: 65,
  pensionSubtraction65: 24_000,
  pensionSubtraction55: 20_000,
};

// IRS Uniform Lifetime Table (2022+). RMDs begin at 73 (SECURE 2.0).
export const RMD_UNIFORM_LIFETIME: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
  94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
  101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0,
  115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};

export const RMD_START_AGE = 73;
