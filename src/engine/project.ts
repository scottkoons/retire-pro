import type {
  IncomeBreakdown,
  IncomeComponent,
  MarkerPoint,
  PlanStatus,
  ProjectionResult,
  Scenario,
  YearRow,
} from '@/domain/types';
import type { Account, AccountKind, ExpenseCategory, Owner, Settings, SocialSecurityClaim } from '@/domain/types';
import { ageToMonthIndex, dateToMonthIndex, monthIndexToAge, monthlyRate } from './timeline';
import { fmtAgeYM } from '@/lib/format';
import {
  resolveTaxConfig,
  estimateAnnualTaxes,
  solveGrossWithdrawal,
  rmd as rmdAmount,
  irmaaPartBSurchargeMonthly,
  type TaxConfig,
  type TaxableIncomeInputs,
  type TaxContext,
  type GrossUpSource,
} from './tax';

export interface MonthState {
  t: number;
  age: number;
  startingBalance: number;
  contributions: number;
  lumpSums: number;
  growth: number;
  returnRate: number; // resolved annual return used for this month's growth
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

/**
 * A legacy fixed-income row that represents Social Security (flagged at seed
 * time, or matched by name for documents saved before the flag existed).
 * Exported so the UI can point out a stray row instead of silently
 * double-counting it alongside the claim-age planner.
 */
export function isLegacySsStream(s: { name: string; isSocialSecurity?: boolean }): boolean {
  return s.isSocialSecurity === true || /social security/i.test(s.name);
}

function streamNominalAt(scn: Scenario, s: Scenario['incomeStreams'][number], t: number, age: number): number {
  if (!s.enabled || age < s.startAge || age > s.endAge) return 0;
  // The SS claim-age planner supersedes the legacy row once enabled — checked
  // here, at the single choke point every caller goes through, so Social
  // Security can never be counted twice regardless of whether the row's own
  // `enabled` flag happens to be stale (a renamed row, a hand-edited backup).
  if (scn.socialSecurity?.enabled && isLegacySsStream(s)) return 0;
  const cm = colaMonthly(scn, s);
  return s.monthlyAmountToday * Math.pow(1 + cm, t); // COLA anchored from today (t=0)
}

/** The yearly row the wealth chart plots at the retirement age. The Balance at
 *  Retirement tile and the Compare table read THIS row's ending balance, so they
 *  always agree with the chart — deposits landing anywhere in the retirement-age
 *  year (e.g. a business sale months after the retirement date) are included. */
function retirementRow(rows: YearRow[], retirementAge: number): YearRow | undefined {
  const target = Math.round(retirementAge);
  return rows.find((r) => r.age === target) ?? (target < (rows[0]?.age ?? 0) ? rows[0] : rows[rows.length - 1]);
}

/** Legacy v1 single-balance projection. Preserved verbatim so migrated v1 documents
 *  (home/healthcare/SS off, no expenses) keep projecting identically. The v2 engine
 *  below handles tax-aware, multi-account scenarios; runProjection dispatches between them. */
export function runProjectionLegacy(scn: Scenario, provider: ReturnProvider = fixedProvider): ProjectionBundle {
  const a = scn.assumptions;
  const years = Math.max(1, Math.round(a.modelEndAge - a.currentAge + 1)); // inclusive => 40
  const T = years * 12;
  const inflM = monthlyRate(a.inflation);
  const tRet = ageToMonthIndex(a.retirementAge, a.currentAge);

  // Pre-resolve lump months.
  const lumps = scn.lumpSums
    .filter((l) => l.enabled)
    .map((l) => ({ ...l, t: lumpMonth(scn, l) }));

  // Contribution windows in month indices. The end month is INCLUSIVE: a payment
  // lands on the 1st of every month from start through end (Jul -> Aug = 2 payments).
  // Typed dates win over stored ages (same rule as lumps and the month inputs), so
  // the engine pays exactly the calendar months the Planner row displays.
  const cMonth = (iso: string | undefined, age: number) =>
    iso ? dateToMonthIndex(iso, a.currentAge, a.birthYear, a.birthMonth) : ageToMonthIndex(age, a.currentAge);
  const contribs = scn.contributions
    .filter((c) => c.enabled)
    .map((c) => ({
      ...c,
      tStart: cMonth(c.startDateOverride, c.startAge),
      tEnd: cMonth(c.endDateOverride, c.endAge),
    }));

  let balance = a.startingBalance;
  let depletionAge: number | null = null;
  const months: MonthState[] = [];

  for (let t = 0; t < T; t++) {
    const age = monthIndexToAge(t, a.currentAge);

    const cpiStart = Math.pow(1 + inflM, t);
    const cpiEnd = Math.pow(1 + inflM, t + 1);

    const { expectedReturn, volatility } = resolveReturn(scn, age);
    const rNet = provider({ age, yearIndex: Math.floor(t / 12), expectedReturn, volatility });
    const rM = monthlyRate(rNet);

    // Contributions active this month (end month inclusive)
    let C = 0;
    for (const c of contribs) {
      if (t >= c.tStart && t <= c.tEnd) {
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

    // Social Security planner (when enabled). In retirement the benefit is cash
    // income; before retirement it is either deposited into the portfolio
    // (investUntilRetirement) or treated as spent like other working-years income.
    if (scn.socialSecurity?.enabled) {
      const spouseOffset = a.spouseAgeOffset ?? 0;
      for (const c of scn.socialSecurity.claims) {
        if (!c.enabled) continue;
        const ownerAge = c.owner === 'spouse' ? age + spouseOffset : age;
        if (ownerAge < Math.min(70, Math.max(62, c.claimAge))) continue;
        const nominal = ssMonthlyBenefitToday(c) * Math.pow(1 + monthlyRate(c.cola), t);
        if (age >= a.retirementAge) G += nominal;
        else if (scn.socialSecurity.investUntilRetirement) C += nominal;
      }
    }

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
      const desiredW = W;
      W = Math.min(W, Math.max(0, balEff));
      // Depletion = the portfolio can no longer fund the requested draw. The clamp
      // above keeps the balance from going negative, so without this check the
      // depletion age (and every Monte Carlo failure) would never trigger.
      // Percent-of-balance draws scale with the balance and correctly never trip it.
      if (depletionAge === null && desiredW > balEff + 1) depletionAge = age;
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
      returnRate: expectedReturn,
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
  const retRow = retirementRow(rows, a.retirementAge);
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
    projectedBalanceAtRetirement: retRow?.endingBalance ?? 0,
    projectedBalanceAtRetirementToday: retRow?.endingBalanceToday ?? 0,
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
      returnRate: slice[0].returnRate,
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
    if (v <= 0) continue; // only streams active at this age appear in the breakdown
    components.push({
      label: s.name,
      monthlyNominal: v,
      taxStatus: s.taxStatus,
      cat: catForStream(s),
    });
  }

  // Streams that have not started yet: dimmed rows with a "from ..." note so the
  // panel explains upcoming income (e.g. Social Security before the claim age).
  // Superseded legacy SS rows are excluded here too — see streamNominalAt.
  for (const s of scn.incomeStreams) {
    if (!s.enabled || s.startAge <= age || s.endAge <= s.startAge) continue;
    if (scn.socialSecurity?.enabled && isLegacySsStream(s)) continue;
    components.push({
      label: s.name,
      monthlyNominal: 0,
      taxStatus: s.taxStatus,
      cat: catForStream(s),
      fromAgeNote: `from ${fmtAgeYM(s.startAge)}`,
      upcoming: true,
    });
  }

  // Social Security planner components: cash income in retirement, an invested
  // deposit before it (investUntilRetirement), or an upcoming hint pre-claim.
  if (scn.socialSecurity?.enabled) {
    const spouseOffset = a.spouseAgeOffset ?? 0;
    for (const c of scn.socialSecurity.claims) {
      if (!c.enabled) continue;
      const label = c.owner === 'spouse' ? 'Social Security (Spouse)' : 'Social Security';
      const cat: 3 | 4 = c.owner === 'spouse' ? 4 : 3;
      const claimSelfAge = Math.min(70, Math.max(62, c.claimAge)) - (c.owner === 'spouse' ? spouseOffset : 0);
      const invest = !!scn.socialSecurity.investUntilRetirement;
      const effectiveStart = invest ? claimSelfAge : Math.max(claimSelfAge, a.retirementAge);
      const nominal = ssMonthlyBenefitToday(c) * Math.pow(1 + monthlyRate(c.cola), t);
      if (age >= claimSelfAge && age >= a.retirementAge) {
        components.push({ label, monthlyNominal: nominal, taxStatus: 'taxable', cat });
      } else if (age >= claimSelfAge && invest) {
        components.push({ label, monthlyNominal: nominal, taxStatus: 'taxable', cat, fromAgeNote: 'invested until retirement' });
      } else if (effectiveStart <= a.modelEndAge) {
        components.push({ label, monthlyNominal: 0, taxStatus: 'taxable', cat, fromAgeNote: `from ${fmtAgeYM(effectiveStart)}`, upcoming: true });
      }
    }
  }

  components.sort((x, y) => y.monthlyNominal - x.monthlyNominal);
  const taxablePerMo = components.filter((c) => c.taxStatus === 'taxable').reduce((s, c) => s + c.monthlyNominal, 0);
  const taxFreePerMo = components.filter((c) => c.taxStatus === 'tax-free').reduce((s, c) => s + c.monthlyNominal, 0);

  return { age, components, taxablePerMo, taxFreePerMo };
}

// ===========================================================================
// v2 tax-aware, multi-account engine
//
// Annual loop (taxes, RMDs, IRMAA, and gross-up are all annual concepts).
// Accumulation years (age < retirementAge) only add contributions / lump sums /
// inheritance and grow; the household's spending need is funded from the
// portfolio only in retirement (matching the v1 decision that pre-retirement
// guaranteed income is informational). The home is amortized every year so net
// worth and equity track correctly even before retirement.
// ===========================================================================

export interface ProjectionOpts {
  /** Inject / override tax tables (e.g. a future user-tuned TaxConfig). */
  taxConfig?: Partial<TaxConfig>;
}

/** SIMPLIFIED APP: the tax-aware v2 surfaces (Net Worth, Cash Flow & Taxes, Home &
 *  Mortgage) were removed, so every scenario now uses the simple accumulation engine
 *  and "Balance at Retirement" always means investment growth (no home/expense drain).
 *  The v2 engine code is kept intact for reversibility — restore the predicate below
 *  (and re-add the routes) to bring it back. */
export function usesV2(_scn: Scenario): boolean {
  return false;
}

/** The original v2 activation predicate, retained for when v2 is re-enabled. */
export function usesV2Full(scn: Scenario): boolean {
  return (
    scn.home?.enabled === true ||
    scn.healthcare?.enabled === true ||
    scn.socialSecurity?.enabled === true ||
    scn.spendingMode === 'expense-driven' ||
    (Array.isArray(scn.expenses) && scn.expenses.some((e) => e.enabled))
  );
}

/** Social Security benefit as a multiple of the FRA benefit, given the claim age.
 *  Early: -5/9% per month for the first 36, -5/12% beyond. Delayed: +2/3% per
 *  month past FRA, capped at age 70. */
/**
 * Monthly SS benefit in today's $ for claiming at `claimAge` (clamped 62-70).
 * Uses the SSA statement quotes (62 / FRA / 70) when both are entered;
 * otherwise applies the standard reduction/credit formula to the FRA benefit.
 *
 * The early-claiming curve is NOT a straight line: the reduction accrues at
 * 5/12% per month for months more than 36 before FRA and 5/9% per month for
 * the final 36 months. We keep that shape (a knot at FRA - 3 years) and scale
 * it to pass exactly through the entered 62 and FRA quotes; a straight line
 * would overstate mid-range ages (e.g. +1.5% at 65 with FRA 67).
 * Delayed credits after FRA are uniform (2/3% per month), so the FRA-to-70
 * segment is genuinely linear.
 */
export function ssMonthlyBenefitToday(c: SocialSecurityClaim, claimAge = c.claimAge): number {
  const age = Math.min(70, Math.max(62, claimAge));
  const { benefitAt62: b62, benefitAtFRA: bFra, benefitAt70: b70, fra } = c;
  if (b62 != null && b70 != null && b62 > 0 && b70 > 0) {
    if (age <= fra) {
      if (fra - 62 <= 0) return bFra;
      const knot = Math.max(62, fra - 3);
      // Formula-shaped reduction fractions at the knot (share of the 62..FRA total).
      const first36 = Math.min((fra - 62) * 12, 36) * (5 / 900);
      const beyond36 = Math.max(0, (fra - 62) * 12 - 36) * (5 / 1200);
      const knotShare = first36 / (first36 + beyond36); // e.g. 2/3 for FRA 67
      const totalRed = bFra - b62;
      const bKnot = bFra - knotShare * totalRed;
      if (age <= knot) {
        const span = knot - 62;
        return span <= 0 ? bKnot : b62 + ((age - 62) / span) * (bKnot - b62);
      }
      const span = fra - knot;
      return span <= 0 ? bFra : bKnot + ((age - knot) / span) * (bFra - bKnot);
    }
    const span = 70 - fra;
    return span <= 0 ? bFra : bFra + ((age - fra) / span) * (b70 - bFra);
  }
  return bFra * ssAdjustmentFactor(age, fra);
}

export function ssAdjustmentFactor(claimAge: number, fra: number): number {
  const months = Math.round((claimAge - fra) * 12);
  if (months === 0) return 1;
  if (months < 0) {
    const early = -months;
    const first = Math.min(early, 36);
    const beyond = Math.max(0, early - 36);
    return Math.max(0, 1 - (first * 5) / 900 - (beyond * 5) / 1200);
  }
  const delay = Math.min(months, Math.round((70 - fra) * 12));
  return 1 + (delay * 2) / 300;
}

/** Standard amortizing annual payment (principal & interest) for a loan. */
function annuityPaymentAnnual(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  return monthly * 12;
}

/** Amortize one year of a mortgage (12 monthly periods), applying any extra
 *  principal (a one-time lump at the start of the year plus a recurring monthly
 *  amount). `principal` and `paid` include the extra, since it is real cash out. */
function amortizeYear(
  balance: number,
  annualRate: number,
  annualPayment: number,
  extraMonthly = 0,
  extraLump = 0,
): { interest: number; principal: number; paid: number; closing: number } {
  let bal = balance;
  const mr = annualRate / 12;
  const pmt = annualPayment / 12;
  let interest = 0;
  let principal = 0;
  if (extraLump > 0 && bal > 0) {
    const e = Math.min(bal, extraLump);
    bal -= e;
    principal += e;
  }
  for (let m = 0; m < 12 && bal > 0; m++) {
    const intM = bal * mr;
    const prinM = Math.max(0, Math.min(bal, pmt - intM));
    bal -= prinM;
    interest += intM;
    principal += prinM;
    if (extraMonthly > 0 && bal > 0) {
      const e = Math.min(bal, extraMonthly);
      bal -= e;
      principal += e;
    }
  }
  return { interest, principal, paid: interest + principal, closing: Math.max(0, bal) };
}

const ZERO_BY_CAT = (): Record<ExpenseCategory, number> => ({
  housing: 0,
  club: 0,
  travel: 0,
  living: 0,
  healthcare: 0,
  longTermCare: 0,
  other: 0,
});

export function runProjectionV2(
  scn: Scenario,
  settings: Settings,
  provider: ReturnProvider = fixedProvider,
  opts?: ProjectionOpts,
): ProjectionBundle {
  const a = scn.assumptions;
  const years = Math.max(1, Math.round(a.modelEndAge - a.currentAge + 1));
  const infl = a.inflation;
  const offset = a.spouseAgeOffset ?? 0;
  const baseCfg = resolveTaxConfig(opts?.taxConfig);
  const rmdStartAge = settings.rmdStartAge ?? baseCfg.rmdStartAge;
  const cfg: TaxConfig = rmdStartAge === baseCfg.rmdStartAge ? baseCfg : { ...baseCfg, rmdStartAge };
  const seq: AccountKind[] = scn.withdrawalSequence?.length
    ? scn.withdrawalSequence
    : settings.defaultWithdrawalSequence ?? ['taxable', 'pretax', 'roth'];
  const ssEnabled = scn.socialSecurity?.enabled === true;

  // ---- account state, tracked by kind (per-owner for pretax RMDs) ----
  const acctEnabled = scn.accounts.filter((x) => x.enabled);
  let taxableBal = sumBal(acctEnabled, 'taxable');
  let rothBal = sumBal(acctEnabled, 'roth');
  let pretaxSelf = acctEnabled.filter((x) => x.kind === 'pretax' && (x.owner ?? 'self') === 'self').reduce((s, x) => s + Math.max(0, x.balance), 0);
  let pretaxSpouse = acctEnabled.filter((x) => x.kind === 'pretax' && x.owner === 'spouse').reduce((s, x) => s + Math.max(0, x.balance), 0);

  // Constant realized-gain fraction on taxable withdrawals (balance-weighted at t0).
  // costBasisRatio is the BASIS fraction (what you paid), so the taxable gain on a
  // withdrawal is (1 - costBasisRatio).
  const taxableAccts = acctEnabled.filter((x) => x.kind === 'taxable');
  const taxableStart = taxableAccts.reduce((s, x) => s + Math.max(0, x.balance), 0);
  const defaultBasis = settings.defaultCostBasisRatio ?? 0.5;
  const basisRatio =
    taxableStart > 0
      ? taxableAccts.reduce((s, x) => s + Math.max(0, x.balance) * (x.costBasisRatio ?? defaultBasis), 0) / taxableStart
      : defaultBasis;
  const gainRatio = Math.max(0, Math.min(1, 1 - basisRatio));

  // Where do monthly contributions land?
  const target = acctEnabled.find((x) => x.contributionTarget) ?? acctEnabled.find((x) => x.kind === 'pretax') ?? acctEnabled[0];
  const targetKind: AccountKind = target?.kind ?? 'pretax';
  const targetOwner: Owner = target?.owner ?? 'self';

  const addCash = (kind: AccountKind, owner: Owner, amt: number) => {
    if (!amt) return;
    if (kind === 'taxable') taxableBal += amt;
    else if (kind === 'roth') rothBal += amt;
    else if (owner === 'spouse') pretaxSpouse += amt;
    else pretaxSelf += amt;
  };

  // ---- home state machine ----
  const home = scn.home;
  const homeEnabled = home?.enabled === true;
  let homeValue = homeEnabled ? home.currentValue : 0;
  let homeMort = homeEnabled ? home.mortgageBalance : 0;
  let homePhase: 'current' | 'new' = 'current';
  // The current loan uses its own rate/remaining term when provided, else falls back.
  let loanRate = homeEnabled ? home.mortgageRate ?? home.loanRate : 0;
  let paymentAnnual = homeEnabled ? annuityPaymentAnnual(homeMort, loanRate, home.mortgageTermYears ?? home.termYears) : 0;
  let clubActive = homeEnabled && !home.plannedPurchase; // club tied to the planned (new) home

  // ---- contribution windows in effective ages: typed dates win over stored
  //      ages, and the end month is inclusive (same rule as the v1 engine) ----
  const effAge = (iso: string | undefined, age: number) =>
    iso ? a.currentAge + dateToMonthIndex(iso, a.currentAge, a.birthYear, a.birthMonth) / 12 : age;
  const contribWindows = scn.contributions
    .filter((c) => c.enabled)
    .map((c) => ({
      ...c,
      sAge: effAge(c.startDateOverride, c.startAge),
      endIncl: effAge(c.endDateOverride, c.endAge) + 1 / 12,
    }));

  // ---- lumps & inheritance pre-resolved to integer years ----
  const lumpByYear = new Map<number, number>();
  for (const l of scn.lumpSums) {
    if (!l.enabled) continue;
    const j = Math.max(0, Math.round(l.age - a.currentAge));
    const cpiToday = Math.pow(1 + infl, j);
    const amt = l.dollarBasis === 'today' ? l.amount * cpiToday : l.amount;
    lumpByYear.set(j, (lumpByYear.get(j) ?? 0) + amt);
  }

  // ---- other loans (car, etc.); the home mortgage is handled separately ----
  const loanState = (scn.liabilities ?? [])
    .filter((l) => l.enabled)
    .map((l) => ({
      rate: l.rate,
      payment: l.monthlyPayment > 0 ? l.monthlyPayment * 12 : annuityPaymentAnnual(l.balance, l.rate, 5),
      bal: l.balance,
    }));

  const months: MonthState[] = [];
  const rows: YearRow[] = [];
  const magiByYear: number[] = [];
  let depletionAge: number | null = null;
  let balanceAtRetire = taxableBal + pretaxSelf + pretaxSpouse + rothBal;
  let guaranteedAtRetire = 0;
  let withdrawalAtRetire = 0;
  const tRetIndex = Math.max(0, Math.round(a.retirementAge - a.currentAge));

  for (let j = 0; j < years; j++) {
    const age = a.currentAge + j;
    const spouseAge = age + offset;
    const calYear = a.birthYear + Math.round(age);
    const yearsFromBase = Math.max(0, calYear - cfg.baseYear);
    const cpiTax = cfg.indexBracketsToInflation ? Math.pow(1 + infl, yearsFromBase) : 1;
    const cpiToday = Math.pow(1 + infl, j);
    const liquidStart = taxableBal + pretaxSelf + pretaxSpouse + rothBal;
    const retired = age >= a.retirementAge;

    const { expectedReturn, volatility } = resolveReturn(scn, age);
    const r = provider({ age, yearIndex: j, expectedReturn, volatility });

    const byCat = ZERO_BY_CAT();

    // ---- inflows that happen every year ----
    let contribThisYear = 0;
    for (const c of contribWindows) {
      if (age < c.endIncl && age + 1 > c.sAge) {
        const yrs = Math.min(c.endIncl, age + 1) - Math.max(c.sAge, age); // fraction of this year active
        const frac = Math.max(0, Math.min(1, yrs));
        contribThisYear += (c.dollarBasis === 'today' ? c.monthlyAmount * cpiToday : c.monthlyAmount) * 12 * frac;
      }
    }
    addCash(targetKind, targetOwner, contribThisYear);

    const lumpThisYear = lumpByYear.get(j) ?? 0;
    if (lumpThisYear) addCash('taxable', 'self', lumpThisYear);

    // inheritance (non-taxable cash inflow to the chosen account kind)
    const inh = scn.inheritance;
    if (inh?.enabled && Math.round(inh.age - a.currentAge) === j) {
      const amt = inh.dollarBasis === 'today' ? inh.amount * cpiToday : inh.amount;
      addCash(inh.toAccountKind, 'self', amt);
    }

    // Status baseline: liquid balance entering retirement, after the year's
    // deposits land. (The displayed Balance at Retirement reads the yearly row
    // instead — see retirementRow.)
    if (j === tRetIndex) balanceAtRetire = taxableBal + pretaxSelf + pretaxSpouse + rothBal;

    // ---- home: purchase transition, amortization, costs (every year) ----
    let homeCost = 0;
    if (homeEnabled) {
      if (home.plannedPurchase && homePhase === 'current' && age >= home.purchaseAge) {
        if (home.sellCurrent) {
          const proceeds = homeValue * (1 - home.sellingCostPct) - homeMort;
          taxableBal += Math.max(0, proceeds); // primary-residence gain assumed excluded
        }
        // acquire the planned home
        const newMort = home.financed ? Math.max(0, home.price - home.downPayment) : 0;
        if (home.downPayment > 0) taxableBal -= home.downPayment;
        if (home.clubInitiation > 0) {
          taxableBal -= home.clubInitiation; // one-time capital cost at closing (funded from taxable, not part of totalSpend)
        }
        homeValue = home.price;
        homeMort = newMort;
        loanRate = home.loanRate;
        paymentAnnual = annuityPaymentAnnual(homeMort, loanRate, home.termYears);
        homePhase = 'new';
        clubActive = true;
      }
      // extra principal toward the active mortgage: recurring monthly + one-time at this age
      const extraMonthly = home.extraMonthlyPrincipal ?? 0;
      const extraLumpThisYear = (home.extraPrincipalPayments ?? [])
        .filter((p) => p.enabled && Math.round(p.age) === Math.round(age))
        .reduce((s, p) => s + p.amount, 0);
      const am = amortizeYear(homeMort, loanRate, paymentAnnual, extraMonthly, extraLumpThisYear);
      homeMort = am.closing;
      homeValue *= 1 + home.growthRate;
      const exemptValue = home.disabledVetExemption ? Math.min(homeValue, 200_000) * 0.5 : 0;
      const propTax = Math.max(0, homeValue - exemptValue) * home.propertyTaxRate;
      const hoa = home.hoaMonthly * 12;
      const clubDues = clubActive ? home.clubMonthly * 12 : 0;
      byCat.housing += am.paid + propTax + hoa;
      byCat.club += clubDues;
      homeCost = am.paid + propTax + hoa + clubDues; // ongoing; club initiation already in byCat.club only at closing
    }
    const homeEquity = homeEnabled ? Math.max(0, homeValue - homeMort) : 0;

    // ---- amortize other loans: payment is a mandatory cost, balance reduces net worth ----
    let loanCost = 0;
    for (const ln of loanState) {
      if (ln.bal <= 0) continue;
      const am = amortizeYear(ln.bal, ln.rate, ln.payment);
      ln.bal = am.closing;
      loanCost += am.paid;
    }
    const loanBalanceTotal = loanState.reduce((sum, ln) => sum + ln.bal, 0);
    if (loanCost > 0) byCat.other += loanCost;

    // ---- guaranteed income (gross, nominal), split by tax character ----
    let ordinaryGuar = 0;
    let ssGross = 0;
    let taxFree = 0;
    for (const s of scn.incomeStreams) {
      if (!s.enabled || age < s.startAge || age > s.endAge) continue;
      const annual = streamNominalAt(scn, s, j * 12, age) * 12;
      if (annual <= 0) continue;
      const isSS = /social security/i.test(s.name);
      if (s.taxStatus === 'tax-free') taxFree += annual;
      else if (isSS && ssEnabled) continue; // SS claims drive it instead
      else if (isSS) ssGross += annual;
      else ordinaryGuar += annual;
    }
    if (ssEnabled) {
      for (const c of scn.socialSecurity.claims) {
        if (!c.enabled) continue;
        const oAge = c.owner === 'spouse' ? spouseAge : age;
        if (oAge + 1e-9 < c.claimAge) continue;
        const monthly = c.benefitAtFRA * ssAdjustmentFactor(c.claimAge, c.fra) * Math.pow(1 + c.cola, j);
        ssGross += monthly * 12;
      }
    }
    const bv = scn.businessVenture;
    if (bv?.enabled && age >= bv.startAge && age < bv.endAge) {
      const grow = bv.dollarBasis === 'today' ? Math.pow(1 + bv.cola, j) : Math.pow(1 + bv.cola, Math.max(0, age - bv.startAge));
      ordinaryGuar += bv.monthlyIncome * grow * 12;
    }

    // ---- spending need (funded only in retirement) ----
    const ctx: TaxContext = {
      primaryAge: age,
      spouseAge,
      calendarYear: calYear,
      cpiFactor: cpiTax,
      magiTwoYearsPrior: magiByYear[j - 2] ?? 0,
    };

    let rmdTotal = 0;
    let withdrawals = 0;
    let drawnPretax = 0;
    let drawnTaxable = 0;
    let drawnRoth = 0;
    let federalTax = 0;
    let stateTax = 0;
    let capGainsTax = 0;
    let niit = 0;
    let irmaaExp = 0;
    let totalTax = 0;
    let ssTaxable = 0;
    let magi = 0;
    let effectiveRate = 0;
    let marginalRate = 0;
    let netSpendable = 0;
    let totalSpend = 0;

    // ---- RMDs (forced pretax draws); rmdAmount returns 0 before rmdStartAge ----
    const rmdSelf = rmdAmount(age, pretaxSelf, cfg);
    const rmdSpouse = rmdAmount(spouseAge, pretaxSpouse, cfg);
    pretaxSelf -= Math.min(pretaxSelf, rmdSelf);
    pretaxSpouse -= Math.min(pretaxSpouse, rmdSpouse);
    rmdTotal = rmdSelf + rmdSpouse;

    // ---- healthcare (Medicare Part B base + IRMAA surcharge), an after-tax cost.
    //      Driven by Medicare eligibility, not retirement, so a 65-67 gap is modeled. ----
    let healthcareExp = 0;
    const hc = scn.healthcare;
    if (hc?.enabled) {
      const selfElig = age >= hc.medicareStartAge;
      const spouseElig = spouseAge >= hc.medicareStartAge;
      const beneficiaries = hc.bothCarryPartB ? (selfElig ? 1 : 0) + (spouseElig ? 1 : 0) : selfElig ? 1 : 0;
      if (beneficiaries > 0) {
        const partB = hc.medicarePartBMonthly * Math.pow(1 + hc.medicalInflation, yearsFromBase) * 12;
        const surcharge = hc.irmaaEnabled ? irmaaPartBSurchargeMonthly(ctx.magiTwoYearsPrior ?? 0, cfg, yearsFromBase) * 12 : 0;
        healthcareExp = beneficiaries * (partB + surcharge);
        irmaaExp = beneficiaries * surcharge;
        byCat.healthcare += healthcareExp;
      }
    }

    // ---- long-term care (Crissy), an after-tax cost during the care window ----
    let ltcExp = 0;
    const ltc = scn.longTermCare;
    if (ltc?.crissyEnabled) {
      if (ltc.useInsuranceInstead) ltcExp = ltc.insurancePremium ?? 0;
      else if (spouseAge >= ltc.startAge && spouseAge < ltc.startAge + ltc.years) ltcExp = ltc.monthly * 12 * cpiToday;
      byCat.longTermCare += ltcExp;
    }

    // ---- lifestyle: funded from the portfolio ONLY in retirement. Pre-retirement
    //      living is assumed covered by earned income modeled off-engine (so that the
    //      explicit contributions remain net savings). ----
    let lifestyle = 0;
    if (retired) {
      if (scn.spendingMode === 'expense-driven') {
        for (const e of scn.expenses) {
          if (!e.enabled || age < e.startAge || age >= e.endAge) continue;
          const rate = e.inflationRate ?? (e.category === 'healthcare' ? (scn.healthcare?.medicalInflation ?? infl) : infl);
          const amt = e.dollarBasis === 'today' ? e.amount * Math.pow(1 + rate, j) : e.amount;
          lifestyle += amt;
          byCat[e.category] += amt;
        }
      } else {
        for (const ph of scn.retirementPhases) {
          if (ph.enabled && age >= ph.startAge && age < ph.endAge) {
            const amt = ph.targetMonthlyIncome * 12 * cpiToday;
            lifestyle += amt;
            byCat.living += amt;
          }
        }
      }
    }

    // Mandatory obligations (home carrying costs, healthcare, LTC) are funded from the
    // portfolio in EVERY year so mortgage principal -> home equity is actually paid for
    // and never appears for free. Lifestyle is added only in retirement.
    totalSpend = lifestyle + healthcareExp + homeCost + ltcExp + loanCost;

    // ---- base income (fixed regardless of discretionary withdrawals) ----
    const baseIncome: TaxableIncomeInputs = {
      ordinaryIncome: ordinaryGuar + rmdTotal,
      longTermGains: 0,
      socialSecurityGross: ssGross,
      taxExemptInterest: 0,
      taxFreeIncome: taxFree,
    };
    const baseRes = estimateAnnualTaxes({ income: baseIncome, ctx, cfg });
    const guaranteedGross = ordinaryGuar + rmdTotal + ssGross + taxFree;
    const guaranteedNet = guaranteedGross - baseRes.totalTax;
    const netNeed = Math.max(0, totalSpend - guaranteedNet);

    // ---- sequenced gross-up withdrawal to meet the net need ----
    const srcMeta: Array<{ kind: AccountKind; src: GrossUpSource }> = [];
    for (const kind of seq) {
      if (kind === 'taxable' && taxableBal > 0) srcMeta.push({ kind, src: { character: 'ltcg', capacity: taxableBal, gainRatio } });
      else if (kind === 'pretax' && pretaxSelf + pretaxSpouse > 0) srcMeta.push({ kind, src: { character: 'ordinary', capacity: pretaxSelf + pretaxSpouse } });
      else if (kind === 'roth' && rothBal > 0) srcMeta.push({ kind, src: { character: 'taxFree', capacity: rothBal } });
    }
    let shortfall = netNeed;
    if (netNeed > 0 && srcMeta.length) {
      const g = solveGrossWithdrawal({ netNeed, baseIncome, ctx, cfg, sources: srcMeta.map((m) => m.src) });
      shortfall = g.shortfall;
      srcMeta.forEach((m, i) => {
        const take = g.draws[i] ?? 0;
        if (m.kind === 'taxable') {
          taxableBal -= take;
          drawnTaxable += take;
        } else if (m.kind === 'roth') {
          rothBal -= take;
          drawnRoth += take;
        } else {
          // pretax: drain self then spouse
          const fromSelf = Math.min(pretaxSelf, take);
          pretaxSelf -= fromSelf;
          const fromSpouse = Math.min(pretaxSpouse, take - fromSelf);
          pretaxSpouse -= fromSpouse;
          drawnPretax += fromSelf + fromSpouse;
        }
      });
    }
    withdrawals = rmdTotal + drawnTaxable + drawnPretax + drawnRoth;

    // Surplus guaranteed income (e.g. an RMD beyond the need) is reinvested in taxable,
    // but ONLY in retirement; pre-retirement surplus guaranteed income is informational
    // (the household's to spend off-engine) and is not banked.
    if (retired && netNeed <= 0 && guaranteedNet > totalSpend) {
      taxableBal += guaranteedNet - totalSpend;
    }

    // ---- final taxes on the realized income ----
    const finalIncome: TaxableIncomeInputs = {
      ordinaryIncome: ordinaryGuar + rmdTotal + drawnPretax,
      longTermGains: drawnTaxable * gainRatio,
      socialSecurityGross: ssGross,
      taxExemptInterest: 0,
      taxFreeIncome: taxFree,
    };
    const fin = estimateAnnualTaxes({ income: finalIncome, ctx, cfg });
    federalTax = fin.ordinaryTax;
    capGainsTax = fin.capGainsTax;
    stateTax = fin.stateTax;
    niit = fin.niit;
    totalTax = fin.totalTax;
    ssTaxable = fin.taxableSS;
    magi = fin.magi;
    effectiveRate = fin.effectiveRate;
    marginalRate = fin.marginalOrdinaryRate;
    netSpendable = guaranteedGross + drawnTaxable + drawnPretax + drawnRoth - totalTax - irmaaExp;

    // depletion: spending need could not be met from any account
    if (shortfall > 1 && depletionAge === null) depletionAge = age;

    if (j === tRetIndex) {
      guaranteedAtRetire = (ordinaryGuar + ssGross + taxFree + rmdTotal) / 12;
      withdrawalAtRetire = (drawnTaxable + drawnPretax + drawnRoth) / 12;
    }
    magiByYear[j] = magi;

    // ---- growth applies to end-of-year balances (after all flows) ----
    const liquidBeforeGrowth = taxableBal + pretaxSelf + pretaxSpouse + rothBal;
    taxableBal = Math.max(0, taxableBal) * (1 + r);
    pretaxSelf = Math.max(0, pretaxSelf) * (1 + r);
    pretaxSpouse = Math.max(0, pretaxSpouse) * (1 + r);
    rothBal = Math.max(0, rothBal) * (1 + r);

    const liquidEnd = taxableBal + pretaxSelf + pretaxSpouse + rothBal;
    const investmentGrowth = liquidEnd - liquidBeforeGrowth;
    const netWorth = liquidEnd + homeEquity - loanBalanceTotal;
    const guaranteedIncomeYear = ordinaryGuar + ssGross + taxFree;

    rows.push({
      age: Math.round(age),
      year: calYear,
      monthIndexEnd: j * 12 + 11,
      cpiFactor: cpiToday,
      startingBalance: liquidStart,
      contributions: contribThisYear,
      lumpSums: lumpThisYear,
      investmentGrowth,
      returnRate: expectedReturn,
      guaranteedIncome: guaranteedIncomeYear,
      withdrawals,
      endingBalance: liquidEnd,
      endingBalanceToday: liquidEnd / cpiToday,
      taxablePerMo: 0,
      taxFreePerMo: 0,
      // v2 fields
      netWorth,
      netWorthToday: netWorth / cpiToday,
      homeEquity,
      mortgageBalance: homeMort,
      accountBalances: { taxable: taxableBal, pretax: pretaxSelf + pretaxSpouse, roth: rothBal },
      rmd: rmdTotal,
      expensesByCategory: byCat,
      federalTax,
      stateTax,
      capGainsTax,
      niit,
      irmaa: irmaaExp,
      totalTax,
      ssTaxable,
      magi,
      effectiveRate,
      marginalRate,
      netSpendable,
    });

    // synthesize 12 flat monthly slices for month-based consumers (income breakdown)
    for (let m = 0; m < 12; m++) {
      months.push({
        t: j * 12 + m,
        age: age + m / 12,
        startingBalance: liquidStart,
        contributions: contribThisYear / 12,
        lumpSums: m === 0 ? lumpThisYear : 0,
        growth: investmentGrowth / 12,
        returnRate: expectedReturn,
        guaranteedIncome: guaranteedIncomeYear / 12,
        targetSpend: totalSpend / 12,
        withdrawal: withdrawals / 12,
        endingBalance: liquidEnd,
        cpi: cpiToday,
      });
    }
  }

  const markers: MarkerPoint[] = scn.lumpSums
    .filter((l) => l.enabled)
    .map((l) => {
      const j = Math.max(0, Math.round(l.age - a.currentAge));
      return { age: a.currentAge + j, balance: rows[Math.min(j, rows.length - 1)]?.endingBalance ?? 0, label: l.name, amount: lumpByYear.get(j) ?? l.amount };
    })
    .filter((mk) => mk.age >= a.currentAge && mk.age <= a.modelEndAge);

  const lastRow = rows[rows.length - 1];
  const endingBalance = lastRow?.endingBalance ?? 0;
  const endingBalanceToday = lastRow?.endingBalanceToday ?? 0;
  const cpiRet = Math.pow(1 + infl, tRetIndex);
  const status: PlanStatus =
    depletionAge !== null
      ? 'shortfall'
      : endingBalanceToday > balanceAtRetire / cpiRet * 0.25
        ? 'onTrack'
        : endingBalanceToday > 0
          ? 'caution'
          : 'shortfall';

  const retRow = retirementRow(rows, a.retirementAge);
  const result: ProjectionResult = {
    rows,
    markers,
    projectedBalanceAtRetirement: retRow?.endingBalance ?? 0,
    projectedBalanceAtRetirementToday: retRow?.endingBalanceToday ?? 0,
    guaranteedMonthlyIncome: guaranteedAtRetire,
    requiredPortfolioWithdrawal: withdrawalAtRetire,
    monthlyIncomeAtRetirement: guaranteedAtRetire + withdrawalAtRetire,
    annualIncomeAtRetirement: (guaranteedAtRetire + withdrawalAtRetire) * 12,
    endingBalance,
    endingBalanceToday,
    depletionAge,
    status,
  };

  return { result, months };
}

function sumBal(accts: Account[], kind: AccountKind): number {
  return accts.filter((x) => x.kind === kind).reduce((s, x) => s + Math.max(0, x.balance), 0);
}

/** Public entry point: dispatch to the tax-aware v2 engine when the scenario uses
 *  v2 features, else the legacy v1 path (keeps migrated documents unchanged). */
export function runProjection(
  scn: Scenario,
  settings?: Settings,
  provider: ReturnProvider = fixedProvider,
  opts?: ProjectionOpts,
): ProjectionBundle {
  if (settings && usesV2(scn)) return runProjectionV2(scn, settings, provider, opts);
  return runProjectionLegacy(scn, provider);
}
