import type { TaxableIncomeInputs, TaxContext, AnnualTaxResult } from './types';
import type { TaxConfig } from './config';
import { socialSecurityTaxable } from './socialSecurity';
import { federalOrdinaryTax, longTermCapGainsTax, marginalOrdinaryRate } from './federal';
import { coloradoTax } from './state';

export interface EstimateInputs {
  income: TaxableIncomeInputs;
  ctx: TaxContext;
  cfg: TaxConfig;
  /** Pension/annuity income eligible for the CO subtraction (default 0, conservative). */
  coPensionSubtractable?: number;
}

export function estimateAnnualTaxes({ income, ctx, cfg, coPensionSubtractable = 0 }: EstimateInputs): AnnualTaxResult {
  const cpi = cfg.indexBracketsToInflation ? ctx.cpiFactor : 1;

  // AGI excluding SS (VA + tax-exempt interest are not here).
  const otherAGI = income.ordinaryIncome + Math.max(0, income.longTermGains);

  // Taxable SS (thresholds not indexed).
  const taxableSS = socialSecurityTaxable(income.socialSecurityGross, otherAGI, income.taxExemptInterest, cfg);

  const agi = otherAGI + taxableSS; // VA excluded by construction
  const magi = agi + income.taxExemptInterest; // VA still excluded

  // Standard deduction (base + 65+ per qualifying spouse), inflation-scaled.
  const add65 = (ctx.primaryAge >= 65 ? cfg.stdDeductionAdditional65 : 0) + (ctx.spouseAge >= 65 ? cfg.stdDeductionAdditional65 : 0);
  // The 2025 act's extra 65+ deduction (tax years 2025-2028): each eligible
  // spouse's amount shrinks by 6% of MAGI above the threshold, so a couple's
  // is gone by $250,000. Not inflation-indexed.
  const sd = cfg.seniorDeduction;
  const seniors = (ctx.primaryAge >= 65 ? 1 : 0) + (ctx.spouseAge >= 65 ? 1 : 0);
  const seniorDeduction =
    ctx.calendarYear >= sd.firstYear && ctx.calendarYear <= sd.lastYear
      ? seniors * Math.max(0, sd.perPerson - sd.phaseoutRate * Math.max(0, magi - sd.phaseoutStart))
      : 0;
  const stdDeduction = (cfg.stdDeductionBase + add65) * cpi + seniorDeduction;

  // Deduction shelters ordinary first, leftover shelters gains.
  const ordinaryAGI = income.ordinaryIncome + taxableSS;
  const ordinaryTaxable = Math.max(0, ordinaryAGI - stdDeduction);
  const deductionLeft = Math.max(0, stdDeduction - ordinaryAGI);
  const gainsTaxable = Math.max(0, Math.max(0, income.longTermGains) - deductionLeft);
  const federalTaxableIncome = ordinaryTaxable + gainsTaxable;

  const ordinaryTax = federalOrdinaryTax(ordinaryTaxable, cfg, cpi);
  const capGainsTax = longTermCapGainsTax(ordinaryTaxable, gainsTaxable, cfg, cpi);

  // Colorado's 55-64 Social Security test uses AGI plus the untaxed part of SS.
  const coModifiedAgi = magi + Math.max(0, income.socialSecurityGross - taxableSS);
  const stateTax = coloradoTax(federalTaxableIncome, taxableSS, ctx.primaryAge, ctx.spouseAge, coPensionSubtractable, cfg, coModifiedAgi);

  // NIIT (not indexed). Net investment income = realized LTCG + taxable interest/dividends.
  const niitBase = Math.max(0, magi - cfg.niit.thresholdMFJ);
  const netInvestmentIncome = Math.max(0, income.longTermGains) + Math.max(0, income.taxableInvestmentIncome ?? 0);
  const niit = Math.min(niitBase, netInvestmentIncome) * cfg.niit.rate;

  const totalTax = ordinaryTax + capGainsTax + stateTax + niit;
  const effectiveRate = agi > 0 ? totalTax / agi : 0;
  const marginalRate = marginalOrdinaryRate(ordinaryTaxable, cfg, cpi);

  return {
    ordinaryTax,
    capGainsTax,
    stateTax,
    niit,
    irmaa: 0, // engine computes via medicare.ts using magiTwoYearsPrior
    totalTax,
    taxableSS,
    agi,
    magi,
    federalTaxableIncome,
    effectiveRate,
    marginalOrdinaryRate: marginalRate,
  };
}
