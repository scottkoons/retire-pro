// Public API for the deterministic tax module.
export type { IncomeCharacter, TaxableIncomeInputs, TaxContext, AnnualTaxResult } from './types';
export type { TaxConfig } from './config';
export type { Bracket, IrmaaTier } from './tables';
export type { GrossUpSource, GrossUpRequest, GrossUpResult } from './grossUp';
export type { EstimateInputs } from './estimate';

export { DEFAULT_TAX_CONFIG_2025, resolveTaxConfig, indexed } from './config';
export { socialSecurityTaxable } from './socialSecurity';
export { federalOrdinaryTax, marginalOrdinaryRate, longTermCapGainsTax } from './federal';
export { coloradoTax } from './state';
export { partBBasePremiumMonthly, irmaaPartBSurchargeMonthly, irmaaPartBSurcharge } from './medicare';
export { rmd, rmdDivisor } from './rmd';
export { estimateAnnualTaxes } from './estimate';
export { solveGrossWithdrawal } from './grossUp';
export * as taxTables from './tables';
