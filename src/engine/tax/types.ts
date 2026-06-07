import type { Dollars, Rate } from '@/domain/types';

/** Tax character of a withdrawal/income dollar. Finer than domain TaxStatus.
 *  ordinary -> federal brackets + CO; ltcg -> 0/15/20 stacked; taxFree -> never taxed. */
export type IncomeCharacter = 'ordinary' | 'ltcg' | 'taxFree';

/** Income/withdrawal handed to the tax estimator for one year, in NOMINAL dollars. */
export interface TaxableIncomeInputs {
  ordinaryIncome: Dollars; // trad/solo-401k withdrawals, RMDs, interest/dividends, earned/business
  longTermGains: Dollars; // realized LTCG (gain portion only)
  socialSecurityGross: Dollars; // total SS, pre-taxation
  taxExemptInterest: Dollars; // muni; added to provisional income
  taxFreeIncome: Dollars; // VA disability + other tax-free; excluded from everything taxable
  /** Investment-income portion of ordinaryIncome (taxable interest + dividends), for NIIT only.
   *  Already counted in ordinaryIncome for AGI; do NOT add it again to AGI. */
  taxableInvestmentIncome?: Dollars;
}

export interface TaxContext {
  primaryAge: number;
  spouseAge: number;
  calendarYear: number;
  cpiFactor: number; // CPI vs base year (1 = no indexing)
  magiTwoYearsPrior?: Dollars; // for IRMAA tier; engine supplies from a ring buffer
}

export interface AnnualTaxResult {
  ordinaryTax: Dollars;
  capGainsTax: Dollars;
  stateTax: Dollars;
  niit: Dollars;
  irmaa: Dollars; // surcharge only; an EXPENSE, not in totalTax (engine fills it)
  totalTax: Dollars; // ordinary + capGains + state + niit
  taxableSS: Dollars;
  agi: Dollars;
  magi: Dollars;
  federalTaxableIncome: Dollars;
  effectiveRate: Rate; // totalTax / agi
  marginalOrdinaryRate: Rate;
}
