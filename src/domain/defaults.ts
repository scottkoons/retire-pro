// Shared v2 default builders, used by both the migration and the seed so the
// 2025-baseline numbers live in one place. Pure functions.
import type {
  Account,
  BusinessVentureConfig,
  HealthcareConfig,
  HomePlan,
  InheritanceConfig,
  LongTermCareConfig,
  SocialSecurityConfig,
} from './types';
import { newId } from './ids';

export function defaultHomePlan(): HomePlan {
  return {
    enabled: true,
    currentValue: 700_000,
    mortgageBalance: 140_000,
    growthRate: 0.03,
    sellCurrent: true,
    sellingCostPct: 0.065,
    mortgageRate: 0.0425, // PLACEHOLDER existing-loan rate
    mortgageTermYears: 22, // PLACEHOLDER remaining term
    extraMonthlyPrincipal: 0,
    extraPrincipalPayments: [],
    plannedPurchase: true,
    purchaseAge: 59,
    price: 1_750_000,
    financed: true, // keep money invested (VA loan)
    downPayment: 0, // VA no-down
    loanRate: 0.065,
    termYears: 30,
    hoaMonthly: 300, // PLACEHOLDER
    propertyTaxRate: 0.0051, // PLACEHOLDER effective rate on value
    disabledVetExemption: true,
    clubInitiation: 75_000, // PLACEHOLDER Kissing Camels initiation
    clubMonthly: 1_200, // PLACEHOLDER dues
    notes: 'Kissing Camels — PLACEHOLDER values, edit in the Home planner',
  };
}

// Neutral home plan for MIGRATED docs: nothing modeled, so v1 numbers are unchanged
// until the user opts in. (The rich Kissing Camels defaults live only in the seed.)
export function emptyHomePlan(): HomePlan {
  return {
    enabled: false,
    currentValue: 0,
    mortgageBalance: 0,
    growthRate: 0.03,
    sellCurrent: false,
    sellingCostPct: 0.065,
    extraMonthlyPrincipal: 0,
    extraPrincipalPayments: [],
    plannedPurchase: false,
    purchaseAge: 65,
    price: 0,
    financed: true,
    downPayment: 0,
    loanRate: 0.065,
    termYears: 30,
    hoaMonthly: 0,
    propertyTaxRate: 0.0051,
    disabledVetExemption: false,
    clubInitiation: 0,
    clubMonthly: 0,
  };
}

// Neutral healthcare for MIGRATED docs: off, so no new costs appear post-migration.
export function neutralHealthcare(): HealthcareConfig {
  return {
    enabled: false,
    medicarePartBMonthly: 185,
    medicalInflation: 0.045,
    bothCarryPartB: false,
    medicareStartAge: 65,
    irmaaEnabled: false,
  };
}

export function defaultHealthcare(): HealthcareConfig {
  return {
    enabled: true,
    medicarePartBMonthly: 185, // 2025 base, per person
    medicalInflation: 0.045,
    bothCarryPartB: true, // both carry Part B; CHAMPVA secondary
    medicareStartAge: 65,
    irmaaEnabled: true,
  };
}

export function defaultLongTermCare(): LongTermCareConfig {
  return {
    crissyEnabled: false, // OFF by default (uncovered-exposure stress test)
    monthly: 5_500, // assisted-living placeholder
    startAge: 85,
    years: 3,
    insurancePremium: undefined,
    useInsuranceInstead: false,
  };
}

export function defaultInheritance(): InheritanceConfig {
  return { enabled: false, age: 75, amount: 0, dollarBasis: 'today', toAccountKind: 'taxable', taxStatus: 'tax-free' };
}

export function defaultBusinessVenture(): BusinessVentureConfig {
  return { enabled: false, name: 'Post-retirement venture', startAge: 68, endAge: 75, monthlyIncome: 0, dollarBasis: 'today', cola: 0.025 };
}

export function defaultSocialSecurity(selfFRA = 67, spouseFRA = 67, enabled = false): SocialSecurityConfig {
  return {
    enabled, // false => legacy SS income streams drive income until SS engine wiring lands
    claims: [
      { owner: 'self', enabled: true, benefitAtFRA: 2_800, fra: selfFRA, claimAge: 67, cola: 0.025 },
      { owner: 'spouse', enabled: true, benefitAtFRA: 2_200, fra: spouseFRA, claimAge: 67, cola: 0.025 },
    ],
  };
}

export function defaultAccounts(): Account[] {
  return [
    { id: newId(), name: 'Taxable brokerage', kind: 'taxable', balance: 268_000, costBasisRatio: 0.5, enabled: true, contributionTarget: false, notes: 'PLACEHOLDER — enter real balance' },
    { id: newId(), name: '401(k)', kind: 'pretax', balance: 600_000, owner: 'self', enabled: true, contributionTarget: true, notes: 'PLACEHOLDER' },
    { id: newId(), name: 'Solo 401(k)', kind: 'pretax', balance: 250_000, owner: 'self', enabled: true, contributionTarget: false, notes: 'PLACEHOLDER' },
    { id: newId(), name: 'Roth IRA', kind: 'roth', balance: 120_000, owner: 'self', enabled: true, contributionTarget: false, notes: 'PLACEHOLDER' },
  ];
}
