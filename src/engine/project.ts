import type {
  IncomeBreakdown,
  IncomeComponent,
  MarkerPoint,
  PlanStatus,
  ProjectionResult,
  Scenario,
  YearRow,
} from '@/domain/types';
import { ageToMonthIndex, dateToMonthIndex, monthIndexToAge, monthlyRate } from './timeline';

export interface MonthState {
  t: number;
  age: number;
  startingBalance: number;
  contributions: number;
  lumpSums: number;
  growth: number;
  guaranteedIncome: number;
  targetSpend: number;
  withdrawal: number;
  endingBalance: number;
  cpi: number;
}

export interface ProjectionBundle {
  result: ProjectionResult;
  months: MonthState[];
}

export type ReturnProvider = (ctx: {
  age: number;
  yearIndex: number;
  expectedReturn: number; // resolved phase return (or scenario fallback)
  volatility: number;
}) => number;

const fixedProvider: ReturnProvider = ({ expectedReturn }) => expectedReturn;

// Status thresholds (shared by deterministic fallback and the Monte Carlo tile).
export const STATUS_THRESHOLD = { onTrack: 0.85, caution: 0.7 };

export function statusFromSuccess(p: number): PlanStatus {
  if (p >= STATUS_THRESHOLD.onTrack) return 'onTrack';
  if (p >= STATUS_THRESHOLD.caution) return 'caution';
  return 'shortfall';
}

function resolveReturn(scn: Scenario, age: number): { expectedReturn: number; volatility: number } {
  const phase = scn.investmentReturnPhases.find(
    (p) => p.enabled && age >= p.startAge && age < p.endAge,
  );
  if (phase) return { expectedReturn: phase.expectedReturn, volatility: phase.volatility };
  return {
    expectedReturn: scn.assumptions.annualReturn,
    volatility: scn.monteCarlo?.returnVolatility ?? 0.12,
  };
}

function lumpMonth(scn: Scenario, ev: { age: number; dateOverride?: string }): number {
  const a = scn.assumptions;
  if (ev.dateOverride) return dateToMonthIndex(ev.dateOverride, a.currentAge, a.birthYear, a.birthMonth);
  return ageToMonthIndex(ev.age, a.currentAge);
}

function colaMonthly(scn: Scenario, s: Scenario['incomeStreams'][number]): number {
  if (!s.inflationAdjusted) return 0;
  const annual =
    s.cola ?? (s.owner === 'spouse' ? scn.assumptions.spouseInflation ?? scn.assumptions.inflation : scn.assumptions.inflation);
  return monthlyRate(annual);
}

function streamNominalAt(scn: Scenario, s: Scenario['incomeStreams'][number], t: number, age: number): number {
  if (!s.enabled || age < s.startAge || age > s.endAge) return 0;
  const cm = colaMonthly(scn, s);
  return s.monthlyAmountToday * Math.pow(1 + cm, t); // COLA anchored from today (t=0)
}

/** Run the deterministic (or, with a stochastic provider, one Monte Carlo) projection. */
export function runProjection(scn: Scenario, provider: ReturnProvider = fixedProvider): ProjectionBundle {
  const a = scn.assumptions;
  const years = Math.max(1, Math.round(a.modelEndAge - a.currentAge + 1)); // inclusive => 40
  const T = years * 12;
  const inflM = monthlyRate(a.inflation);
  const tRet = ageToMonthIndex(a.retirementAge, a.currentAge);

  // Pre-resolve lump months.
  const lumps = scn.lumpSums
    .filter((l) => l.enabled)
    .map((l) => ({ ...l, t: lumpMonth(scn, l) }));

  let balance = a.startingBalance;
  let depletionAge: number | null = null;
  const months: MonthState[] = [];
  let balanceAtRetire = balance;

  for (let t = 0; t < T; t++) {
    const age = monthIndexToAge(t, a.currentAge);
    if (t === tRet) balanceAtRetire = balance;

    const cpiStart = Math.pow(1 + inflM, t);
    const cpiEnd = Math.pow(1 + inflM, t + 1);

    const { expectedReturn, volatility } = resolveReturn(scn, age);
    const rNet = provider({ age, yearIndex: Math.floor(t / 12), expectedReturn, volatility });
    const rM = monthlyRate(rNet);

    // Contributions active this month
    let C = 0;
    for (const c of scn.contributions) {
      if (!c.enabled) continue;
      if (age >= c.startAge && age < c.endAge) {
        C += c.dollarBasis === 'today' ? c.monthlyAmount * cpiStart : c.monthlyAmount;
      }
    }

    // Lump sums landing this month
    let L = 0;
    for (const l of lumps) {
      if (l.t === t) L += l.dollarBasis === 'today' ? l.amount * cpiStart : l.amount;
    }

    // Guaranteed income (nominal) this month
    let G = 0;
    for (const s of scn.incomeStreams) G += streamNominalAt(scn, s, t, age);

    // Spending target (nominal) this month
    let S = 0;
    for (const ph of scn.retirementPhases) {
      if (ph.enabled && age >= ph.startAge && age < ph.endAge) {
        S += ph.targetMonthlyIncome * cpiStart;
      }
    }

    // Withdrawal driven by the chosen strategy.
    //  percent-of-balance: rate x balance (the rate directly drives the draw)
    //  fixed-amount:       fixed today's-$/yr, inflated to nominal
    //  target-income:      fund the spending-phase gap (target minus guaranteed income)
    const balEff = balance + C + L;
    let W = 0;
    if (age >= a.retirementAge) {
      if (scn.withdrawal.type === 'percent-of-balance') {
        W = Math.max(0, balEff) * ((scn.withdrawal.rate ?? 0.04) / 12);
      } else if (scn.withdrawal.type === 'fixed-amount') {
        W = ((scn.withdrawal.amount ?? 0) / 12) * cpiStart;
      } else {
        W = Math.max(0, S - G);
      }
      W = Math.min(W, Math.max(0, balEff));
    }

    const growth = (balance + C + L - W) * rM;
    let end = balance + C + L - W + growth;
    if (end < 0) {
      if (depletionAge === null) depletionAge = age;
      end = 0;
    }

    months.push({
      t,
      age,
      startingBalance: balance,
      contributions: C,
      lumpSums: L,
      growth,
      guaranteedIncome: G,
      targetSpend: S,
      withdrawal: W,
      endingBalance: end,
      cpi: cpiEnd,
    });
    balance = end;
  }

  const rows = rollupYears(months, a.currentAge, a.birthYear);
  const markers: MarkerPoint[] = lumps
    .filter((l) => l.t >= 0 && l.t < T)
    .map((l) => ({
      age: monthIndexToAge(l.t, a.currentAge),
      balance: months[l.t]?.endingBalance ?? 0,
      label: l.name,
      amount: months[l.t]?.lumpSums ?? l.amount,
    }));

  // Tiles — read the actual values at the retirement month so they track the strategy.
  const mRet = months[tRet];
  const gAtRet = mRet
    ? mRet.guaranteedIncome
    : scn.incomeStreams.reduce((sum, s) => sum + streamNominalAt(scn, s, tRet, a.retirementAge), 0);
  const requiredWithdrawal = mRet ? mRet.withdrawal : 0;
  const monthlyIncome = gAtRet + requiredWithdrawal;
  const cpiRet = Math.pow(1 + inflM, tRet);
  const endNominal = months[months.length - 1]?.endingBalance ?? 0;
  const cpiEndAll = months[months.length - 1]?.cpi ?? 1;

  const endingBalanceToday = endNominal / cpiEndAll;
  const status: PlanStatus =
    depletionAge !== null
      ? 'shortfall'
      : endingBalanceToday > a.startingBalance * 0.25
        ? 'onTrack'
        : endingBalanceToday > 0
          ? 'caution'
          : 'shortfall';

  const result: ProjectionResult = {
    rows,
    markers,
    projectedBalanceAtRetirement: balanceAtRetire,
    projectedBalanceAtRetirementToday: balanceAtRetire / cpiRet,
    guaranteedMonthlyIncome: gAtRet,
    requiredPortfolioWithdrawal: requiredWithdrawal,
    monthlyIncomeAtRetirement: monthlyIncome,
    annualIncomeAtRetirement: monthlyIncome * 12,
    endingBalance: endNominal,
    endingBalanceToday,
    depletionAge,
    status,
  };

  return { result, months };
}

function rollupYears(months: MonthState[], currentAge: number, birthYear: number): YearRow[] {
  const rows: YearRow[] = [];
  const years = Math.ceil(months.length / 12);
  for (let j = 0; j < years; j++) {
    const slice = months.slice(j * 12, j * 12 + 12);
    if (slice.length === 0) continue;
    const last = slice[slice.length - 1];
    const age = Math.round(currentAge + j);
    const sum = (sel: (m: MonthState) => number) => slice.reduce((s, m) => s + sel(m), 0);
    rows.push({
      age,
      year: birthYear + age,
      monthIndexEnd: last.t,
      cpiFactor: last.cpi,
      startingBalance: slice[0].startingBalance,
      contributions: sum((m) => m.contributions),
      lumpSums: sum((m) => m.lumpSums),
      investmentGrowth: sum((m) => m.growth),
      guaranteedIncome: sum((m) => m.guaranteedIncome),
      withdrawals: sum((m) => m.withdrawal),
      endingBalance: last.endingBalance,
      endingBalanceToday: last.endingBalance / last.cpi,
      taxablePerMo: 0,
      taxFreePerMo: 0,
    });
  }
  return rows;
}

function catForStream(s: Scenario['incomeStreams'][number]): IncomeComponent['cat'] {
  if (s.taxStatus === 'tax-free' || /\bVA\b/i.test(s.name)) return 2;
  if (s.owner === 'spouse') return 4;
  if (/social security/i.test(s.name)) return 3;
  return 5;
}

/** Income breakdown (the dashboard card) at a chosen age. */
export function incomeBreakdownAtAge(scn: Scenario, months: MonthState[], age: number): IncomeBreakdown {
  const a = scn.assumptions;
  const t = Math.max(0, Math.min(months.length - 1, ageToMonthIndex(age, a.currentAge)));
  const m = months[t];
  const components: IncomeComponent[] = [];

  // Investment withdrawal (portfolio) — strategy tax status
  if (m && m.withdrawal > 0) {
    components.push({
      label: 'Investment withdrawal',
      monthlyNominal: m.withdrawal,
      taxStatus: scn.withdrawal.taxStatus,
      cat: 1,
    });
  }

  for (const s of scn.incomeStreams) {
    const v = streamNominalAt(scn, s, t, age);
    if (v <= 0) continue;
    const startsLater = s.startAge > a.currentAge && Math.abs(s.startAge - age) < 0.001;
    components.push({
      label: s.name,
      monthlyNominal: v,
      taxStatus: s.taxStatus,
      cat: catForStream(s),
      fromAgeNote: s.startAge > age + 0.001 ? `FROM AGE ${Math.round(s.startAge)}` : startsLater ? undefined : undefined,
    });
  }

  components.sort((x, y) => y.monthlyNominal - x.monthlyNominal);
  const taxablePerMo = components.filter((c) => c.taxStatus === 'taxable').reduce((s, c) => s + c.monthlyNominal, 0);
  const taxFreePerMo = components.filter((c) => c.taxStatus === 'tax-free').reduce((s, c) => s + c.monthlyNominal, 0);

  return { age, components, taxablePerMo, taxFreePerMo };
}
