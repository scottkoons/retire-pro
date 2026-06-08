import { z } from 'zod';
import type { PersistedDocument } from '@/domain/types';

const Rate = z.number().finite();
const Ratio01 = z.number().min(0).max(1); // bounded fraction (e.g. cost-basis ratio)
const Dollars = z.number().finite();
const Age = z.number().min(0).max(130);
const Id = z.string().min(1);
const TaxStatus = z.enum(['taxable', 'tax-free']);
const Owner = z.enum(['self', 'spouse']);
const DisplayMode = z.enum(['today', 'actual']);
const DollarBasis = z.enum(['today', 'actual']);
const AccountKind = z.enum(['taxable', 'pretax', 'roth']);
const ExpenseCategory = z.enum(['housing', 'club', 'travel', 'living', 'healthcare', 'longTermCare', 'other']);
const SpendingMode = z.enum(['expense-driven', 'phase-target']);

export const AccountSchema = z.object({
  id: Id,
  name: z.string(),
  kind: AccountKind,
  balance: Dollars,
  costBasisRatio: Ratio01.optional(),
  owner: Owner.optional(),
  returnOverride: Rate.optional(),
  contributionTarget: z.boolean().optional(),
  lastUpdated: z.string().optional(),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const LoanSchema = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(['mortgage', 'auto', 'student', 'personal', 'other']),
  balance: Dollars,
  rate: Rate,
  monthlyPayment: Dollars,
  lastUpdated: z.string().optional(),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const ExpenseItemSchema = z.object({
  id: Id,
  name: z.string(),
  category: ExpenseCategory,
  amount: Dollars,
  dollarBasis: DollarBasis,
  startAge: Age,
  endAge: Age,
  inflationRate: Rate.optional(),
  owner: Owner.optional(),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const ExtraPrincipalPaymentSchema = z.object({
  id: Id,
  age: Age,
  amount: Dollars,
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const HomePlanSchema = z.object({
  enabled: z.boolean(),
  currentValue: Dollars,
  mortgageBalance: Dollars,
  growthRate: Rate,
  sellCurrent: z.boolean(),
  sellingCostPct: Rate,
  mortgageRate: Rate.optional(),
  mortgageTermYears: z.number().int().positive().optional(),
  extraMonthlyPrincipal: Dollars.optional(),
  extraPrincipalPayments: z.array(ExtraPrincipalPaymentSchema).optional(),
  plannedPurchase: z.boolean(),
  purchaseAge: Age,
  price: Dollars,
  financed: z.boolean(),
  downPayment: Dollars,
  loanRate: Rate,
  termYears: z.number().int().positive(),
  hoaMonthly: Dollars,
  propertyTaxRate: Rate,
  disabledVetExemption: z.boolean(),
  clubInitiation: Dollars,
  clubMonthly: Dollars,
  notes: z.string().optional(),
});

export const SocialSecurityClaimSchema = z.object({
  owner: Owner,
  enabled: z.boolean(),
  benefitAtFRA: Dollars,
  fra: Age,
  claimAge: Age,
  cola: Rate,
});

export const SocialSecurityConfigSchema = z.object({
  enabled: z.boolean(),
  claims: z.array(SocialSecurityClaimSchema),
});

export const HealthcareConfigSchema = z.object({
  enabled: z.boolean(),
  medicarePartBMonthly: Dollars,
  medicalInflation: Rate,
  bothCarryPartB: z.boolean(),
  medicareStartAge: Age,
  irmaaEnabled: z.boolean(),
  notes: z.string().optional(),
});

export const LongTermCareConfigSchema = z.object({
  crissyEnabled: z.boolean(),
  monthly: Dollars,
  startAge: Age,
  years: z.number().nonnegative(),
  insurancePremium: Dollars.optional(),
  useInsuranceInstead: z.boolean(),
});

export const InheritanceConfigSchema = z.object({
  enabled: z.boolean(),
  age: Age,
  amount: Dollars,
  dollarBasis: DollarBasis,
  toAccountKind: AccountKind,
  taxStatus: TaxStatus,
  notes: z.string().optional(),
});

export const BusinessVentureConfigSchema = z.object({
  enabled: z.boolean(),
  name: z.string(),
  startAge: Age,
  endAge: Age,
  monthlyIncome: Dollars,
  dollarBasis: DollarBasis,
  cola: Rate,
  notes: z.string().optional(),
});

export const MonthlyContributionSchema = z.object({
  id: Id,
  name: z.string(),
  startAge: Age,
  endAge: Age,
  monthlyAmount: Dollars,
  dollarBasis: DollarBasis,
  enabled: z.boolean(),
  startDateOverride: z.string().optional(),
  endDateOverride: z.string().optional(),
  notes: z.string().optional(),
});

export const LumpSumEventSchema = z.object({
  id: Id,
  name: z.string(),
  age: Age,
  amount: Dollars,
  dollarBasis: DollarBasis,
  taxStatus: TaxStatus.optional(),
  enabled: z.boolean(),
  dateOverride: z.string().optional(),
  notes: z.string().optional(),
});

export const IncomeStreamSchema = z.object({
  id: Id,
  name: z.string(),
  monthlyAmountToday: Dollars,
  startAge: Age,
  endAge: Age,
  taxStatus: TaxStatus,
  cola: Rate.optional(),
  inflationAdjusted: z.boolean(),
  owner: Owner,
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const RetirementPhaseSchema = z.object({
  id: Id,
  name: z.string(),
  startAge: Age,
  endAge: Age,
  targetMonthlyIncome: Dollars,
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const InvestmentReturnPhaseSchema = z.object({
  id: Id,
  name: z.string(),
  startAge: Age,
  endAge: Age,
  expectedReturn: Rate,
  volatility: Rate,
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export const WithdrawalStrategySchema = z.object({
  type: z.enum(['percent-of-balance', 'fixed-amount', 'target-income']),
  rate: Rate.optional(),
  amount: Dollars.optional(),
  taxStatus: TaxStatus,
});

export const ScenarioAssumptionsSchema = z.object({
  birthYear: z.number().int(),
  birthMonth: z.number().int().min(0).max(11),
  birthDay: z.number().int().min(1).max(31),
  currentAge: Age,
  retirementAge: Age,
  modelEndAge: Age,
  startingBalance: Dollars,
  annualReturn: Rate,
  inflation: Rate,
  spouseInflation: Rate.optional(),
  spouseAgeOffset: z.number().optional(),
  displayMode: DisplayMode,
});

export const ScenarioSchema = z.object({
  id: Id,
  name: z.string(),
  presetKey: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  assumptions: ScenarioAssumptionsSchema,
  contributions: z.array(MonthlyContributionSchema),
  lumpSums: z.array(LumpSumEventSchema),
  incomeStreams: z.array(IncomeStreamSchema),
  retirementPhases: z.array(RetirementPhaseSchema),
  investmentReturnPhases: z.array(InvestmentReturnPhaseSchema),
  withdrawal: WithdrawalStrategySchema,
  accounts: z.array(AccountSchema).min(1),
  expenses: z.array(ExpenseItemSchema),
  home: HomePlanSchema,
  socialSecurity: SocialSecurityConfigSchema,
  healthcare: HealthcareConfigSchema,
  longTermCare: LongTermCareConfigSchema,
  inheritance: InheritanceConfigSchema,
  businessVenture: BusinessVentureConfigSchema,
  liabilities: z.array(LoanSchema).optional(),
  withdrawalSequence: z.array(AccountKind).min(1),
  spendingMode: SpendingMode,
  kind: z.enum(['business-sell', 'business-hold']).optional(),
  monteCarlo: z
    .object({ returnVolatility: Rate.optional(), simulations: z.number().optional() })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SettingsSchema = z.object({
  defaultModelEndAge: Age,
  defaultInflation: Rate,
  defaultDisplayMode: DisplayMode,
  monteCarlo: z.object({ simulations: z.number().int().positive(), returnVolatility: Rate }),
  theme: z.enum(['dark', 'light']),
  household: z.string(),
  defaultWithdrawalSequence: z.array(AccountKind).min(1),
  defaultCostBasisRatio: Ratio01,
  rmdStartAge: Age,
});

export const PersistedDocumentSchema = z
  .object({
    schemaVersion: z.number().int(),
    appVersion: z.string(),
    savedAt: z.string(),
    scenarios: z.array(ScenarioSchema).min(1),
    activeScenarioId: Id,
    settings: SettingsSchema,
  })
  .refine((d) => d.scenarios.some((s) => s.id === d.activeScenarioId), {
    message: 'activeScenarioId must reference an existing scenario',
  });

export const UiStateSchema = z.object({
  displayModeOverride: DisplayMode.nullable(),
  chartRange: z.enum(['10Y', 'MAX']),
  showMonteCarloBand: z.boolean(),
  sidebarCollapsed: z.boolean().default(false),
  railCollapsed: z.boolean().default(false),
});

export const BackupFileSchema = z.object({
  kind: z.literal('retirepro-backup'),
  schemaVersion: z.number().int(),
  appVersion: z.string(),
  exportedAt: z.string(),
  // Permissive on import so older (v1) backups are migrated before strict validation;
  // parseBackup migrates document then validates with PersistedDocumentSchema.
  document: z.record(z.unknown()),
});

// Drift guard: fails compile if the schema diverges from the hand-written type.
type _Assert = z.infer<typeof PersistedDocumentSchema> extends PersistedDocument ? true : never;
const _assert: _Assert = true as const;
void _assert;
