// ============================================================================
// RetirePro canonical domain model — the single source of truth.
// The engine, store, Monte Carlo, and PDF all import from here.
// Money is whole US dollars. Rates are decimals (0.07 = 7%). Timing is by age.
// ============================================================================

export type Rate = number; // decimal fraction, 0.07 = 7%
export type Dollars = number; // whole US dollars
export type Age = number; // years, fractional allowed (56.42)

export type TaxStatus = 'taxable' | 'tax-free';
export type Owner = 'self' | 'spouse';
export type DisplayMode = 'today' | 'actual';
export type DollarBasis = 'today' | 'actual';
export type PresetKey = 'conservative' | 'moderate' | 'aggressive';

// ---- v2 literals ----
export type AccountKind = 'taxable' | 'pretax' | 'roth';
export type FilingStatus = 'mfj' | 'single';
export type ExpenseCategory = 'housing' | 'club' | 'travel' | 'living' | 'healthcare' | 'longTermCare' | 'other';
export type SpendingMode = 'expense-driven' | 'phase-target';
export type ClaimAge = number;
export type BusinessPath = 'business-sell' | 'business-hold';

export interface ScenarioAssumptions {
  birthYear: number;
  birthMonth: number; // 0-11
  birthDay: number; // 1-31
  currentAge: Age;
  retirementAge: Age;
  modelEndAge: Age;
  startingBalance: Dollars;
  annualReturn: Rate; // fallback for ages not covered by a return phase
  inflation: Rate;
  spouseInflation?: Rate;
  spouseAgeOffset?: number; // Crissy age = self age + offset (default 0)
  displayMode: DisplayMode;
}

export interface MonthlyContribution {
  id: string;
  name: string;
  startAge: Age;
  endAge: Age;
  monthlyAmount: Dollars;
  dollarBasis: DollarBasis; // how monthlyAmount is denominated
  enabled: boolean;
  startDateOverride?: string; // ISO yyyy-mm-dd typed by user
  endDateOverride?: string;
  notes?: string;
}

export interface LumpSumEvent {
  id: string;
  name: string;
  age: Age;
  amount: Dollars; // positive = inflow
  dollarBasis: DollarBasis;
  taxStatus?: TaxStatus;
  enabled: boolean;
  dateOverride?: string;
  notes?: string;
}

export interface IncomeStream {
  id: string;
  name: string;
  monthlyAmountToday: Dollars; // today's $ (spec-fixed)
  startAge: Age;
  endAge: Age;
  taxStatus: TaxStatus;
  cola?: Rate; // explicit COLA override
  inflationAdjusted: boolean; // false = flat nominal
  owner: Owner;
  enabled: boolean;
  notes?: string;
}

export interface RetirementPhase {
  id: string;
  name: string;
  startAge: Age;
  endAge: Age;
  targetMonthlyIncome: Dollars; // today's $
  enabled: boolean;
  notes?: string;
}

export interface InvestmentReturnPhase {
  id: string;
  name: string;
  startAge: Age;
  endAge: Age;
  expectedReturn: Rate;
  volatility: Rate;
  enabled: boolean;
  notes?: string;
}

export type WithdrawalType = 'percent-of-balance' | 'fixed-amount' | 'target-income';

export interface WithdrawalStrategy {
  type: WithdrawalType;
  rate?: Rate; // percent-of-balance
  amount?: Dollars; // fixed-amount, today's $/yr
  taxStatus: TaxStatus;
}

export interface ScenarioMonteCarlo {
  returnVolatility?: Rate;
  simulations?: number;
}

// ----------------------------- v2 entities ---------------------------------

export interface Account {
  id: string;
  name: string;
  kind: AccountKind; // tax-treatment axis (orthogonal to TaxStatus)
  balance: Dollars; // current nominal balance
  costBasisRatio?: Rate; // taxable only: fraction of a withdrawal that is realized gain (0..1)
  owner?: Owner; // IRAs/401k are owner-scoped for RMDs; undefined => joint/taxable
  returnOverride?: Rate;
  contributionTarget?: boolean; // the single account routed monthly contributions land in
  enabled: boolean;
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: Dollars; // ANNUAL amount, in the chosen dollarBasis
  dollarBasis: DollarBasis;
  startAge: Age;
  endAge: Age; // exclusive (age < endAge)
  inflationRate?: Rate; // override; else scenario inflation (or medical inflation for healthcare)
  owner?: Owner;
  enabled: boolean;
  notes?: string;
}

export interface HomePlan {
  enabled: boolean;
  // current residence
  currentValue: Dollars;
  mortgageBalance: Dollars;
  growthRate: Rate;
  sellCurrent: boolean;
  sellingCostPct: Rate;
  // planned purchase
  plannedPurchase: boolean;
  purchaseAge: Age;
  price: Dollars;
  financed: boolean;
  downPayment: Dollars;
  loanRate: Rate;
  termYears: number;
  hoaMonthly: Dollars;
  propertyTaxRate: Rate; // effective annual rate on value
  disabledVetExemption: boolean; // CO: 50% of first $200k of value exempt
  clubInitiation: Dollars; // one-time
  clubMonthly: Dollars; // dues
  notes?: string;
}

// Engine output (not persisted); typed here so visuals/insights share the shape.
export interface MortgageState {
  age: number;
  year: number;
  openingBalance: number;
  principalPaid: number;
  interestPaid: number;
  payment: number; // annual P&I
  closingBalance: number;
  homeValue: number;
  equity: number;
}

export interface SocialSecurityClaim {
  owner: Owner;
  enabled: boolean;
  benefitAtFRA: Dollars; // monthly, today's $
  fra: Age;
  claimAge: ClaimAge;
  cola: Rate;
}

export interface SocialSecurityConfig {
  enabled: boolean; // false => legacy SS income streams drive income
  claims: SocialSecurityClaim[];
}

export interface HealthcareConfig {
  enabled: boolean;
  medicarePartBMonthly: Dollars; // base 2025 ~185 per person
  medicalInflation: Rate;
  bothCarryPartB: boolean;
  medicareStartAge: Age;
  irmaaEnabled: boolean;
  notes?: string;
}

export interface LongTermCareConfig {
  crissyEnabled: boolean; // OFF by default (uncovered-exposure stress test)
  monthly: Dollars; // today's $
  startAge: Age;
  years: number;
  insurancePremium?: Dollars; // optional LTC-insurance annual premium alternative
  useInsuranceInstead: boolean;
}

export interface InheritanceConfig {
  enabled: boolean;
  age: Age;
  amount: Dollars;
  dollarBasis: DollarBasis;
  toAccountKind: AccountKind;
  taxStatus: TaxStatus;
  notes?: string;
}

export interface BusinessVentureConfig {
  enabled: boolean;
  name: string;
  startAge: Age;
  endAge: Age;
  monthlyIncome: Dollars;
  dollarBasis: DollarBasis;
  cola: Rate;
  notes?: string;
}

export interface Scenario {
  id: string;
  name: string;
  presetKey?: PresetKey;
  assumptions: ScenarioAssumptions;
  contributions: MonthlyContribution[];
  lumpSums: LumpSumEvent[];
  incomeStreams: IncomeStream[];
  retirementPhases: RetirementPhase[];
  investmentReturnPhases: InvestmentReturnPhase[];
  withdrawal: WithdrawalStrategy; // legacy simple strategy, kept as fallback
  // ---- v2 additions (migration supplies defaults; required afterward) ----
  accounts: Account[];
  expenses: ExpenseItem[];
  home: HomePlan;
  socialSecurity: SocialSecurityConfig;
  healthcare: HealthcareConfig;
  longTermCare: LongTermCareConfig;
  inheritance: InheritanceConfig;
  businessVenture: BusinessVentureConfig;
  withdrawalSequence: AccountKind[]; // default ['taxable','pretax','roth']
  spendingMode: SpendingMode;
  kind?: BusinessPath; // identifies the Sell Early / Hold Restaurants pair
  monteCarlo?: ScenarioMonteCarlo;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  defaultModelEndAge: Age;
  defaultInflation: Rate;
  defaultDisplayMode: DisplayMode;
  monteCarlo: {
    simulations: number;
    returnVolatility: Rate;
  };
  theme: 'dark' | 'light';
  household: string;
  // ---- v2 defaults ----
  defaultWithdrawalSequence: AccountKind[];
  defaultCostBasisRatio: Rate;
  rmdStartAge: Age;
}

export interface PersistedDocument {
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  scenarios: Scenario[];
  activeScenarioId: string;
  settings: Settings;
}

export interface UiState {
  displayModeOverride: DisplayMode | null;
  chartRange: '10Y' | 'MAX';
  showMonteCarloBand: boolean;
  sidebarCollapsed: boolean;
}

// ----------------------------- Engine outputs ------------------------------

export interface YearRow {
  age: number;
  year: number;
  monthIndexEnd: number;
  cpiFactor: number;
  startingBalance: number;
  contributions: number;
  lumpSums: number;
  investmentGrowth: number;
  guaranteedIncome: number;
  withdrawals: number;
  endingBalance: number; // nominal
  endingBalanceToday: number;
  taxablePerMo: number;
  taxFreePerMo: number;
  // ---- v2 optional (populated by the refactored engine; absent until then) ----
  netWorth?: number;
  netWorthToday?: number;
  homeEquity?: number;
  mortgageBalance?: number;
  accountBalances?: Partial<Record<AccountKind, number>>;
  rmd?: number;
  expensesByCategory?: Partial<Record<ExpenseCategory, number>>;
  federalTax?: number;
  stateTax?: number;
  capGainsTax?: number;
  niit?: number;
  irmaa?: number;
  totalTax?: number;
  ssTaxable?: number;
  magi?: number;
  effectiveRate?: number;
  marginalRate?: number;
  netSpendable?: number;
}

export interface MarkerPoint {
  age: number;
  balance: number;
  label: string;
  amount: number;
}

export interface IncomeComponent {
  label: string;
  monthlyNominal: number;
  taxStatus: TaxStatus;
  cat: 1 | 2 | 3 | 4 | 5 | 6;
  fromAgeNote?: string;
}

export interface IncomeBreakdown {
  age: number;
  components: IncomeComponent[];
  taxablePerMo: number;
  taxFreePerMo: number;
}

export type PlanStatus = 'onTrack' | 'caution' | 'shortfall';

export interface ProjectionResult {
  rows: YearRow[];
  markers: MarkerPoint[];
  projectedBalanceAtRetirement: number;
  projectedBalanceAtRetirementToday: number;
  guaranteedMonthlyIncome: number;
  requiredPortfolioWithdrawal: number;
  monthlyIncomeAtRetirement: number;
  annualIncomeAtRetirement: number;
  endingBalance: number;
  endingBalanceToday: number;
  depletionAge: number | null;
  status: PlanStatus;
}
