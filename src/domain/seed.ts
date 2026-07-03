import type { PersistedDocument, Scenario, UiState, IncomeStream, LumpSumEvent, ExpenseItem, BusinessPath } from './types';
import { newId } from './ids';
import { applyPreset, cloneScenario } from './presets';
import {
  defaultAccounts,
  defaultHomePlan,
  defaultHealthcare,
  defaultLongTermCare,
  defaultInheritance,
  defaultBusinessVenture,
  defaultSocialSecurity,
} from './defaults';
import { APP_VERSION, SCHEMA_VERSION } from '@/persistence/constants';

const now = () => new Date().toISOString();

function commonIncomeStreams(): IncomeStream[] {
  return [
    { id: newId(), name: 'VA Benefits', monthlyAmountToday: 3_500, startAge: 56, endAge: 95, taxStatus: 'tax-free', cola: 0.025, inflationAdjusted: true, owner: 'self', enabled: true },
    { id: newId(), name: 'Social Security (Scott)', monthlyAmountToday: 2_800, startAge: 67, endAge: 95, taxStatus: 'taxable', cola: 0.025, inflationAdjusted: true, owner: 'self', enabled: true, isSocialSecurity: true },
    { id: newId(), name: 'Social Security (Crissy)', monthlyAmountToday: 2_200, startAge: 67, endAge: 95, taxStatus: 'taxable', cola: 0.025, inflationAdjusted: true, owner: 'spouse', enabled: true, isSocialSecurity: true },
  ];
}

function commonExpenses(): ExpenseItem[] {
  return [
    { id: newId(), name: 'Travel (go-go years)', category: 'travel', amount: 25_000, dollarBasis: 'today', startAge: 67, endAge: 81, enabled: true, notes: 'Higher early-retirement travel' },
    { id: newId(), name: 'Travel (slow-go)', category: 'travel', amount: 12_000, dollarBasis: 'today', startAge: 81, endAge: 95, enabled: true },
    { id: newId(), name: 'General living', category: 'living', amount: 72_000, dollarBasis: 'today', startAge: 67, endAge: 95, enabled: true, notes: 'PLACEHOLDER — food, utilities, insurance, autos' },
  ];
}

function sellEarlyLumps(): LumpSumEvent[] {
  return [
    { id: newId(), name: 'CalSox / Tax Refund', age: 56.5, amount: 40_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'WesternEdge Distribution', age: 57, amount: 150_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'Restaurant Sale (early)', age: 60, amount: 900_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'Dissolve WesternEdge', age: 62, amount: 300_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'Dissolve RMBH', age: 63, amount: 300_000, dollarBasis: 'actual', enabled: true },
  ];
}

function holdRestaurantsLumps(): LumpSumEvent[] {
  return [
    { id: newId(), name: 'CalSox / Tax Refund', age: 56.5, amount: 40_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'WesternEdge Distribution', age: 57, amount: 150_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'Restaurant Sale (later, higher)', age: 65, amount: 1_200_000, dollarBasis: 'actual', enabled: true },
    { id: newId(), name: 'Dissolve RMBH', age: 66, amount: 300_000, dollarBasis: 'actual', enabled: true },
  ];
}

function baseScenario(name: string, path: BusinessPath): Scenario {
  const ts = now();
  const earned: IncomeStream[] =
    path === 'business-hold'
      ? [{ id: newId(), name: 'Restaurant income (final years)', monthlyAmountToday: 9_000, startAge: 65, endAge: 67, taxStatus: 'taxable', cola: 0.025, inflationAdjusted: true, owner: 'self', enabled: true }]
      : [{ id: newId(), name: 'Reduced income (pre-sale)', monthlyAmountToday: 3_000, startAge: 58, endAge: 60, taxStatus: 'taxable', cola: 0.025, inflationAdjusted: true, owner: 'self', enabled: true }];

  return {
    id: newId(),
    name,
    presetKey: undefined,
    kind: path,
    assumptions: {
      birthYear: 1970,
      birthMonth: 3,
      birthDay: 28,
      currentAge: 56,
      retirementAge: 67,
      modelEndAge: 95,
      startingBalance: 268_000, // legacy mirror; accounts are the source of truth post-engine-refactor
      annualReturn: 0.07,
      inflation: 0.025,
      spouseInflation: 0.025,
      spouseAgeOffset: 0,
      displayMode: 'today',
    },
    contributions: [
      { id: newId(), name: 'Current', startAge: 56.1, endAge: 56.43, monthlyAmount: 5_258, dollarBasis: 'today', enabled: true, startDateOverride: '2026-06-01', endDateOverride: '2026-10-01' },
      { id: newId(), name: 'After Calibra Sale', startAge: 56.43, endAge: 60, monthlyAmount: 7_000, dollarBasis: 'today', enabled: true },
      { id: newId(), name: 'Pre-retirement', startAge: 60, endAge: 67, monthlyAmount: 1_000, dollarBasis: 'today', enabled: true },
    ],
    lumpSums: path === 'business-hold' ? holdRestaurantsLumps() : sellEarlyLumps(),
    incomeStreams: [...commonIncomeStreams(), ...earned],
    retirementPhases: [
      { id: newId(), name: 'Retirement', startAge: 67, endAge: 95, targetMonthlyIncome: 12_000, enabled: true, notes: 'Used only when spending mode = phase-target' },
    ],
    investmentReturnPhases: [],
    withdrawal: { type: 'percent-of-balance', rate: 0.04, taxStatus: 'taxable' },
    accounts: defaultAccounts(),
    expenses: commonExpenses(),
    home: defaultHomePlan(),
    socialSecurity: defaultSocialSecurity(67, 67, false),
    healthcare: defaultHealthcare(),
    longTermCare: defaultLongTermCare(),
    inheritance: defaultInheritance(),
    businessVenture: defaultBusinessVenture(),
    withdrawalSequence: ['taxable', 'pretax', 'roth'],
    spendingMode: 'phase-target',
    createdAt: ts,
    updatedAt: ts,
  };
}

export function defaultUi(): UiState {
  return { displayModeOverride: null, chartRange: 'MAX', showMonteCarloBand: false, sidebarCollapsed: false, railCollapsed: false };
}

export function seedDocument(): { doc: PersistedDocument; ui: UiState } {
  const ts = now();
  const sellEarly = baseScenario('Sell Early', 'business-sell');
  const hold = baseScenario('Hold Restaurants', 'business-hold');
  const conservative = applyPreset(cloneScenario(sellEarly, 'Conservative', ts), 'conservative', ts);
  const moderate = applyPreset(cloneScenario(sellEarly, 'Moderate', ts), 'moderate', ts);
  const aggressive = applyPreset(cloneScenario(sellEarly, 'Aggressive', ts), 'aggressive', ts);
  // Preset clones inherit the business-path kind from Sell Early; clear it so the
  // business switcher only matches the two explicit business scenarios.
  for (const s of [conservative, moderate, aggressive]) s.kind = undefined;

  const scenarios = [sellEarly, hold, conservative, moderate, aggressive];

  return {
    doc: {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      savedAt: ts,
      scenarios,
      activeScenarioId: sellEarly.id,
      settings: {
        defaultModelEndAge: 95,
        defaultInflation: 0.025,
        defaultDisplayMode: 'today',
        monteCarlo: { simulations: 1000, returnVolatility: 0.12 },
        theme: 'dark',
        household: 'Scott & Crissy',
        defaultWithdrawalSequence: ['taxable', 'pretax', 'roth'],
        defaultCostBasisRatio: 0.5,
        rmdStartAge: 73,
      },
    },
    ui: defaultUi(),
  };
}
