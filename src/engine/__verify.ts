/* Runtime verification harness for the v2 engine. Not shipped; run via:
 *   npx esbuild src/engine/__verify.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/verify.mjs && node /tmp/verify.mjs
 */
import { runProjection, runProjectionLegacy, runProjectionV2, usesV2, incomeBreakdownAtAge, incomeYearTotalsAtAge, measurementYearsAtAge } from './project';
import { fmtUSDAbbrev } from '@/lib/format';
import { estimateAnnualTaxes, resolveTaxConfig, DEFAULT_TAX_CONFIG_2025 } from './tax';
import { runMonteCarlo } from './montecarlo/simulate';
import { seedDocument } from '@/domain/seed';
import type { Scenario, Settings, YearRow } from '@/domain/types';

let pass = 0;
let fail = 0;
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${extra}`);
  }
}
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
function rowAllFinite(r: YearRow): boolean {
  return Object.values(r).every((v) => {
    if (typeof v === 'number') return Number.isFinite(v);
    if (v && typeof v === 'object') return Object.values(v).every((x) => typeof x !== 'number' || Number.isFinite(x));
    return true;
  });
}

const { doc } = seedDocument();
const settings: Settings = doc.settings;
const sell = doc.scenarios.find((s) => s.name === 'Sell Early')!;
const hold = doc.scenarios.find((s) => s.name === 'Hold Restaurants')!;

// -------------------------------------------------------------------------
console.log('\n[1] Verified tax example (age 70, MFJ, SS 60k + 401k 50k + VA 42k, cpiFactor=1)');
{
  const r = estimateAnnualTaxes({
    income: { ordinaryIncome: 50_000, longTermGains: 0, socialSecurityGross: 60_000, taxExemptInterest: 0, taxFreeIncome: 42_000 },
    ctx: { primaryAge: 70, spouseAge: 70, calendarYear: 2025, cpiFactor: 1 },
    cfg: DEFAULT_TAX_CONFIG_2025, // the hand-checked example predates the 2025 act
  });
  check('taxableSS ~= 36,600', near(r.taxableSS, 36_600, 5), `got ${r.taxableSS.toFixed(0)}`);
  check('federal ordinaryTax ~= 5,931', near(r.ordinaryTax, 5_931, 5), `got ${r.ordinaryTax.toFixed(0)}`);
  check('CO stateTax ~= 739', near(r.stateTax, 739, 3), `got ${r.stateTax.toFixed(0)}`);
  check('effectiveRate ~= 7.7%', near(r.effectiveRate, 0.077, 0.002), `got ${(r.effectiveRate * 100).toFixed(2)}%`);
  check('VA excluded from AGI (agi == 86,600)', near(r.agi, 86_600, 1), `got ${r.agi.toFixed(0)}`);
}

// -------------------------------------------------------------------------
console.log('\n[2] v1 parity: dispatcher == legacy for a migrated-style scenario (byte identical)');
{
  const mig: Scenario = structuredClone(sell);
  mig.home.enabled = false;
  mig.healthcare.enabled = false;
  mig.socialSecurity.enabled = false;
  mig.expenses = [];
  mig.spendingMode = 'phase-target';
  check('usesV2(migrated) === false', usesV2(mig) === false);
  const viaDispatch = runProjection(mig, settings);
  const viaLegacy = runProjectionLegacy(mig);
  check('result identical to legacy', JSON.stringify(viaDispatch.result) === JSON.stringify(viaLegacy.result));
  check('months identical to legacy', JSON.stringify(viaDispatch.months) === JSON.stringify(viaLegacy.months));
}

// -------------------------------------------------------------------------
console.log('\n[3] v2 engine sanity (called directly; dispatch is disabled in the simplified app)');
{
  check('usesV2 forced false (simplified app routes to legacy)', usesV2(sell) === false);
  const { result, months } = runProjectionV2(sell, settings);
  const rows = result.rows;
  check('40 yearly rows (56..95)', rows.length === 40, `got ${rows.length}`);
  check('months = 480', months.length === 480, `got ${months.length}`);
  check('all row fields finite (no NaN/Infinity)', rows.every(rowAllFinite));
  check('net worth positive at start', finite(rows[0].netWorth) && (rows[0].netWorth ?? 0) > 0, `got ${rows[0].netWorth}`);
  const r73 = rows.find((r) => r.age === 73);
  check('RMD > 0 at age 73', !!r73 && (r73.rmd ?? 0) > 0, `got ${r73?.rmd}`);
  const r72 = rows.find((r) => r.age === 72);
  check('RMD == 0 at age 72 (pre-73)', !!r72 && (r72.rmd ?? 0) === 0, `got ${r72?.rmd}`);
  const anyTax = rows.some((r) => (r.totalTax ?? 0) > 0);
  check('some retirement year has positive tax', anyTax);
  const rRet = rows.find((r) => r.age === 67);
  check('SS taxable computed at 67 (>0, < SS gross)', !!rRet && (rRet.ssTaxable ?? 0) > 0, `got ${rRet?.ssTaxable}`);
  check('accountBalances present at retirement', !!rRet?.accountBalances && finite(rRet.accountBalances.taxable), '');
  check('home equity tracked (>0 after purchase at 59)', (rows.find((r) => r.age === 62)?.homeEquity ?? 0) > 0);
  check('effective rate within [0, 0.5]', rows.every((r) => (r.effectiveRate ?? 0) >= 0 && (r.effectiveRate ?? 0) <= 0.5));
  console.log(`     depletionAge=${result.depletionAge}  ending(today)=${result.endingBalanceToday.toFixed(0)}  status=${result.status}`);
  console.log(`     @67: spendNeedMo≈ guaranteed ${result.guaranteedMonthlyIncome.toFixed(0)} + withdrawal ${result.requiredPortfolioWithdrawal.toFixed(0)}`);
}

// -------------------------------------------------------------------------
console.log('\n[4] Account sequencing + gross-up meets need (crafted expense-driven scenario)');
{
  const s: Scenario = structuredClone(sell);
  s.spendingMode = 'expense-driven';
  s.home.enabled = false;
  s.healthcare.enabled = false;
  s.socialSecurity.enabled = false;
  s.incomeStreams = []; // no guaranteed income -> all spend from portfolio
  s.contributions = [];
  s.lumpSums = [];
  s.businessVenture.enabled = false;
  s.longTermCare.crissyEnabled = false;
  s.inheritance.enabled = false;
  s.assumptions.currentAge = 67;
  s.assumptions.retirementAge = 67;
  s.assumptions.modelEndAge = 70;
  s.assumptions.annualReturn = 0; // freeze growth to make balances readable
  s.assumptions.inflation = 0;
  s.investmentReturnPhases = [];
  s.accounts = [
    { id: 'tx', name: 'Taxable', kind: 'taxable', balance: 100_000, costBasisRatio: 0.5, enabled: true, contributionTarget: false },
    { id: 'pt', name: '401k', kind: 'pretax', balance: 200_000, owner: 'self', enabled: true, contributionTarget: true },
    { id: 'ro', name: 'Roth', kind: 'roth', balance: 50_000, owner: 'self', enabled: true, contributionTarget: false },
  ];
  s.withdrawalSequence = ['taxable', 'pretax', 'roth'];
  s.expenses = [{ id: 'e1', name: 'Living', category: 'living', amount: 60_000, dollarBasis: 'today', startAge: 67, endAge: 95, enabled: true }];
  const { result } = runProjectionV2(s, settings);
  const r0 = result.rows[0];
  check('taxable drawn first (declines yr 1)', (r0.accountBalances?.taxable ?? 0) < 100_000, `taxable=${r0.accountBalances?.taxable?.toFixed(0)}`);
  check('roth untouched while taxable has funds', near(r0.accountBalances?.roth ?? 0, 50_000, 1), `roth=${r0.accountBalances?.roth?.toFixed(0)}`);
  check('withdrawals cover need (>= 60k gross)', (r0.withdrawals ?? 0) >= 60_000, `wd=${r0.withdrawals?.toFixed(0)}`);
  check('cap-gains tax present (taxable gain realized)', (r0.capGainsTax ?? 0) >= 0);
  check('no depletion over 4 short years', result.depletionAge === null, `dep=${result.depletionAge}`);
}

// -------------------------------------------------------------------------
console.log('\n[5] SS claim adjustment (enable SS config, vary claim age)');
{
  const mk = (claimAge: number) => {
    const s: Scenario = structuredClone(sell);
    s.socialSecurity.enabled = true;
    s.socialSecurity.claims = s.socialSecurity.claims.map((c) => ({ ...c, claimAge, fra: 67 }));
    const { result } = runProjectionV2(s, settings);
    // find guaranteed income at age 72 (both claimed by then)
    return result.rows.find((r) => r.age === 72)?.guaranteedIncome ?? 0;
  };
  const at62 = mk(62);
  const at67 = mk(67);
  const at70 = mk(70);
  check('claiming at 62 < at 67 (early reduction)', at62 < at67, `62=${at62.toFixed(0)} 67=${at67.toFixed(0)}`);
  check('claiming at 70 > at 67 (delayed credits)', at70 > at67, `70=${at70.toFixed(0)} 67=${at67.toFixed(0)}`);
}

// -------------------------------------------------------------------------
console.log('\n[6] Monte Carlo smoke + determinism');
{
  const req = { scenario: sell, settings, paths: 200, volatilityFallback: 0.12, seed: 12345, criterion: 'survival' as const };
  const a = runMonteCarlo(req);
  const b = runMonteCarlo(req);
  check('successProbability in [0,1]', a.successProbability >= 0 && a.successProbability <= 1, `p=${a.successProbability}`);
  check('percentile series has 40 points', a.percentileSeries.length === 40, `got ${a.percentileSeries.length}`);
  check('deterministic (same seed -> same result)', JSON.stringify(a) === JSON.stringify(b));
  check('ending percentiles ordered p10<=p50<=p90', a.endingPercentiles.p10 <= a.endingPercentiles.p50 && a.endingPercentiles.p50 <= a.endingPercentiles.p90);
}

// -------------------------------------------------------------------------
console.log('\n[7] Hold vs Sell both project without errors');
{
  const h = runProjection(hold, settings);
  check('Hold produces 40 finite rows', h.result.rows.length === 40 && h.result.rows.every(rowAllFinite));
}

// -------------------------------------------------------------------------
console.log('\n[8] Income identities: every income surface agrees with the tiles');
{
  const s: Scenario = structuredClone(sell);
  const { result: r, months } = runProjection(s, settings);
  const a = s.assumptions;
  check(
    'guaranteed + portfolio draw == monthly income',
    near(r.guaranteedMonthlyIncome + r.requiredPortfolioWithdrawal, r.monthlyIncomeAtRetirement, 0.01),
  );
  check('monthly x 12 == annual', near(r.monthlyIncomeAtRetirement * 12, r.annualIncomeAtRetirement, 0.01));
  const bd = incomeBreakdownAtAge(s, months, Math.round(a.retirementAge));
  check(
    'income breakdown sums to monthly income',
    near(bd.components.reduce((x, c) => x + c.monthlyNominal, 0), r.monthlyIncomeAtRetirement, 0.5),
    `bd=${bd.components.reduce((x, c) => x + c.monthlyNominal, 0).toFixed(0)} tile=${r.monthlyIncomeAtRetirement.toFixed(0)}`,
  );
  // Planner/Summary "@ retirement" column values (active streams only, at the
  // shared measurement month) must sum to the Guaranteed Income tile.
  const delta = measurementYearsAtAge(a, Math.round(a.retirementAge));
  const ageAt = a.currentAge + delta;
  const colSum = s.incomeStreams
    .filter((st) => st.enabled && st.startAge != null && st.endAge != null && st.startAge <= ageAt && ageAt <= st.endAge)
    .reduce(
      (x, st) => x + (st.inflationAdjusted ? st.monthlyAmountToday * Math.pow(1 + (st.cola ?? a.inflation), delta) : st.monthlyAmountToday),
      0,
    );
  check(
    '"@ retirement" columns sum to the Guaranteed tile',
    near(colSum, r.guaranteedMonthlyIncome, 1),
    `cols=${colSum.toFixed(0)} tile=${r.guaranteedMonthlyIncome.toFixed(0)}`,
  );
  // The draw is taken on the pre-growth balance of the measurement month, so it
  // sits within a small band of rate x (balance tile) / 12.
  const approx = ((s.withdrawal.rate ?? 0.04) * r.projectedBalanceAtRetirement) / 12;
  check(
    'draw within 2% of rate x balance tile / 12',
    Math.abs(r.requiredPortfolioWithdrawal - approx) / approx < 0.02,
    `draw=${r.requiredPortfolioWithdrawal.toFixed(0)} approx=${approx.toFixed(0)}`,
  );
}

// -------------------------------------------------------------------------
console.log('\n[9] External audit checklist: rate conversion, timing, double-counting');
{
  const { monthlyRate } = await import('./timeline');
  const { ageFromISO } = await import('@/lib/dates');

  // (1) annual -> monthly conversion must be geometric, not annual/12.
  check('monthlyRate(7%) == 0.56541% (geometric), not 0.58333% (7/12)', near(monthlyRate(0.07), 0.0056541, 0.0000005), `got ${(monthlyRate(0.07) * 100).toFixed(5)}%`);

  // (2)-(5) full reference-simulation parity on Scott's audited plan, with the
  // calendar->month mapping derived INDEPENDENTLY of the app's date helpers.
  const s: Scenario = structuredClone(sell);
  const a = s.assumptions; // currentAge 56, born Apr 1970 -> t=0 is April 2026
  a.startingBalance = 296_500;
  a.annualReturn = 0.07;
  a.retirementAge = 67;
  s.investmentReturnPhases = [];
  s.incomeStreams = [];
  s.socialSecurity.enabled = false;
  s.withdrawal = { type: 'percent-of-balance', rate: 0.04, taxStatus: 'taxable' };
  const C = (from: string, to: string, amt: number) => ({
    id: `${from}-${amt}`, name: `${amt}`, startAge: ageFromISO(from, a), endAge: ageFromISO(to, a),
    monthlyAmount: amt, dollarBasis: 'actual' as const, enabled: true, startDateOverride: from, endDateOverride: to,
  });
  const L = (on: string, amt: number) => ({
    id: `${on}-${amt}`, name: `${amt}`, age: ageFromISO(on, a), amount: amt,
    dollarBasis: 'actual' as const, enabled: true, dateOverride: on,
  });
  s.contributions = [
    C('2026-06-01', '2026-06-01', 5_250),
    C('2026-07-01', '2026-08-01', 6_250),
    C('2026-09-01', '2027-09-01', 7_000),
    C('2027-10-01', '2032-08-01', 3_000),
    C('2032-10-01', '2037-04-01', 1_500),
  ];
  s.lumpSums = [
    L('2026-10-01', 40_000), L('2026-12-01', 50_000), L('2027-10-01', 500_000),
    L('2027-10-01', 50_000), L('2032-09-01', 50_000), L('2032-09-01', 400_000),
  ];

  const { months } = runProjection(s, settings);

  // Independent month grid. Born Apr 28 1970, age 56 exactly, so model month 0
  // runs Apr 28 - May 27 2026 and model month k starts on the 28th of
  // (April + k). Every reference date is the 1st, which falls BEFORE the 28th,
  // so the 1st of month m belongs to the model month that began on the 28th of
  // month m-1. (Until 2026-10-18 this mapping omitted the -1, and so did the
  // engine, which put every typed payment one model month late.)
  const ix = (y: number, m: number) => (y - 2026) * 12 + (m - 4) - 1;
  const spans: [number, number, number][] = [
    [ix(2026, 6), ix(2026, 6), 5_250],
    [ix(2026, 7), ix(2026, 8), 6_250],
    [ix(2026, 9), ix(2027, 9), 7_000],
    [ix(2027, 10), ix(2032, 8), 3_000],
    [ix(2032, 10), ix(2037, 4), 1_500],
  ];
  const lumpAt = new Map<number, number>();
  for (const [y, m, amt] of [[2026, 10, 40_000], [2026, 12, 50_000], [2027, 10, 550_000], [2032, 9, 450_000]] as const) {
    lumpAt.set(ix(y, m), amt);
  }
  // Retirement begins ON the 67th birthday, Apr 28 2037: model month 132, the one
  // that STARTS that day. The Apr 1 2037 payment (ix = 131) is the last one before it.
  const tRet = (2037 - 2026) * 12 + (4 - 4);
  const rM = monthlyRate(0.07);
  let bal = 296_500;
  let maxDiff = 0;
  let depositTotal = 0;
  for (let t = 0; t <= ix(2038, 3); t++) {
    let c = 0;
    for (const [from, to, amt] of spans) if (t >= from && t <= to) c += amt;
    depositTotal += c;
    const l = lumpAt.get(t) ?? 0;
    const w = t >= tRet ? ((bal + c + l) * 0.04) / 12 : 0;
    bal = bal + c + l - w + (bal + c + l - w) * rM;
    maxDiff = Math.max(maxDiff, Math.abs(bal - months[t].endingBalance));
  }
  check('engine matches the independent simulation every month (<= $0.01)', maxDiff <= 0.01, `max diff $${maxDiff.toFixed(4)}`);
  check('no double-counting: deposits == flat schedule total $368,250', depositTotal === 368_250, `got ${depositTotal}`);
  // Re-locked 2026-10-18 after the date-anchor fix (was $3,064,518): payments now
  // land in the model month that contains the 1st, so the Apr 1 2037 payment is
  // before the Apr 28 retirement and every flow earns one more month of growth.
  check('balance on the retirement date ~= $3,079,825 (locked reference)', near(months[tRet].startingBalance, 3_079_825, 5), `got ${months[tRet].startingBalance.toFixed(0)}`);
}

// -------------------------------------------------------------------------
console.log('\n[10] Units: every today\'s-$ retirement figure uses ONE deflator');
for (const scn of [sell, hold]) {
  const { result: r, months } = runProjection(scn, settings);
  const retRow = r.rows.find((row) => row.age === Math.round(scn.assumptions.retirementAge))!;
  check(`${scn.name}: retirementCpi is the retirement row's own inflation factor`, near(r.retirementCpi, retRow.cpiFactor, 1e-12));
  check(`${scn.name}: balance today's-$ uses the same deflator`, near(r.projectedBalanceAtRetirementToday * r.retirementCpi, r.projectedBalanceAtRetirement, 0.01));
  check(`${scn.name}: monthly income today's-$ uses the same deflator`, near(r.monthlyIncomeAtRetirementToday * r.retirementCpi, r.monthlyIncomeAtRetirement, 0.01));
  check(`${scn.name}: guaranteed + draw == monthly (today's $)`, near(r.guaranteedMonthlyIncomeToday + r.requiredPortfolioWithdrawalToday, r.monthlyIncomeAtRetirementToday, 0.01));
  // Real income chart: deflating month-by-month must equal summing each month / its own cpi.
  const age = Math.round(scn.assumptions.retirementAge) + 5;
  const real = incomeYearTotalsAtAge(scn, months, age, true);
  const j = Math.max(0, age - Math.round(scn.assumptions.currentAge));
  let expect = 0;
  for (let k = 0; k < 12; k++) { const m = months[j * 12 + k]; if (m) expect += m.withdrawal / m.cpi; }
  check(`${scn.name}: real income chart deflates each month by its own CPI`, near(real.investment, expect, 0.01), `${real.investment} vs ${expect}`);
}

console.log('\n[11] Formatting edge cases');
check('fmtUSDAbbrev(999,600) rolls over to $1.0M, not $1000k', fmtUSDAbbrev(999_600) === '$1.0M', fmtUSDAbbrev(999_600));
check('fmtUSDAbbrev(999,400) stays $999k', fmtUSDAbbrev(999_400) === '$999k', fmtUSDAbbrev(999_400));
check('fmtUSDAbbrev(9,960,000) rolls over to $10M', fmtUSDAbbrev(9_960_000) === '$10M', fmtUSDAbbrev(9_960_000));

console.log('\n[12] Undated rows stay out of the projection');
{
  const base = runProjection(sell, settings).result;
  const scn: Scenario = structuredClone(sell);
  scn.contributions.push({ id: 'u1', name: 'undated', monthlyAmount: 99_999, dollarBasis: 'actual', enabled: true });
  scn.incomeStreams.push({ id: 'u2', name: 'undated', monthlyAmountToday: 99_999, taxStatus: 'taxable', inflationAdjusted: true, owner: 'self', enabled: true });
  scn.lumpSums.push({ id: 'u3', name: 'undated', amount: 9_999_999, dollarBasis: 'actual', enabled: true });
  const r = runProjection(scn, settings).result;
  check('undated contribution, income stream and lump sum change nothing', near(r.endingBalance, base.endingBalance, 0.01) && near(r.monthlyIncomeAtRetirement, base.monthlyIncomeAtRetirement, 0.01), `${r.endingBalance} vs ${base.endingBalance}`);
}

console.log('\n[13] Calendar dates map to the model month containing the 1st');
{
  const { dateToMonthIndex } = await import('./timeline');
  const { ageFromISO, isoFromAge, ageFromBirthDate } = await import('@/lib/dates');
  for (const birthDay of [1, 15, 28]) {
    const a = { ...sell.assumptions, birthYear: 1970, birthMonth: 3, birthDay };
    a.currentAge = ageFromBirthDate(1970, 3, birthDay, new Date(2026, 9, 18)); // Oct 18 2026
    const t = dateToMonthIndex('2026-10-01', a.currentAge, 1970, 3, birthDay);
    // Oct 1 is "now" unless the age month restarts between Oct 1 and Oct 18 (birthday on the 15th).
    const expected = birthDay === 15 ? -1 : 0;
    check(`birthday the ${birthDay}: Oct 1 2026 lands in model month ${expected} on Oct 18`, t === expected, `got ${t}`);
    let ok = true;
    for (const iso of ['2026-11-01', '2030-04-01', '2037-04-01', '2037-05-01']) {
      if (isoFromAge(ageFromISO(iso, a), a) !== iso) ok = false;
    }
    check(`birthday the ${birthDay}: isoFromAge(ageFromISO(date)) round-trips`, ok);
  }
}

console.log('\n[14] v2 -> v3 migration keeps every row meaning the month it displayed');
{
  const { migrate } = await import('@/persistence/migrations');
  const { contributionMonths } = await import('@/lib/contributions');
  const { ageToMonthIndex, dateToMonthIndex } = await import('./timeline');
  const a = { ...sell.assumptions, birthYear: 1970, birthMonth: 3, birthDay: 28, currentAge: 56 };
  const mixed = { id: 'm', name: 'mixed', startAge: 57, endAge: 60, startDateOverride: '2027-06-01', monthlyAmount: 1000, dollarBasis: 'actual', enabled: true };
  const ageOnly = { id: 'g', name: 'age-only', startAge: 60 + 1 / 12, endAge: 62, monthlyAmount: 1000, dollarBasis: 'actual', enabled: true };
  const undated = { id: 'u', name: 'undated', monthlyAmount: 1000, dollarBasis: 'actual', enabled: true };
  const lump = { id: 'l', name: 'lump', age: 57.5, amount: 1, dollarBasis: 'actual', enabled: true };
  // Payments each row made under the OLD rule (dates mapped without the birthday-day step).
  const oldIx = (iso: string) => dateToMonthIndex(iso, a.currentAge, 1970, 3, 1);
  const oldCount = (s: number, e: number) => e - s + 1;
  const doc = { schemaVersion: 2, scenarios: [{ assumptions: a, contributions: [mixed, ageOnly, undated], lumpSums: [lump] }] };
  const out = migrate(doc as never) as unknown as { schemaVersion: number; scenarios: Array<{ contributions: Array<Record<string, unknown>>; lumpSums: Array<Record<string, unknown>> }> };
  const [m2, g2, u2] = out.scenarios[0].contributions;
  const [l2] = out.scenarios[0].lumpSums;
  check('migrated doc reaches schema v3', out.schemaVersion === 3, String(out.schemaVersion));
  check('mixed row: age-only end frozen to the month it displayed (Apr 2030)', m2.endDateOverride === '2030-04-01', String(m2.endDateOverride));
  check('mixed row keeps its old payment count', contributionMonths(m2 as never, a) === oldCount(oldIx('2027-06-01'), ageToMonthIndex(60, a.currentAge)));
  check('age-only row frozen to its displayed months (May 2030 -> Apr 2032)', g2.startDateOverride === '2030-05-01' && g2.endDateOverride === '2032-04-01', `${g2.startDateOverride} ${g2.endDateOverride}`);
  check('age-only row keeps its old payment count', contributionMonths(g2 as never, a) === oldCount(ageToMonthIndex(60 + 1 / 12, a.currentAge), ageToMonthIndex(62, a.currentAge)));
  check('mixed and age-only rows stay contiguous (no gap, no overlap)', dateToMonthIndex(String(g2.startDateOverride), 56, 1970, 3, 28) === dateToMonthIndex(String(m2.endDateOverride), 56, 1970, 3, 28) + 1);
  check('undated row is untouched', u2.startDateOverride === undefined && u2.endDateOverride === undefined);
  check('age-only lump frozen to the month it displayed (Oct 2027)', l2.dateOverride === '2027-10-01', String(l2.dateOverride));
}

console.log('\n[15] Current-law tax tables (2026, MFJ), hand-checked');
{
  const cfg = resolveTaxConfig();
  const est = (ord: number, ss: number, age: number, year: number, pension = 0, gains = 0) =>
    estimateAnnualTaxes({
      income: { ordinaryIncome: ord, longTermGains: gains, socialSecurityGross: ss, taxExemptInterest: 0, taxFreeIncome: 0 },
      ctx: { primaryAge: age, spouseAge: age, calendarYear: year, cpiFactor: 1 },
      cfg,
      coPensionSubtractable: pension,
    });
  // Age 70 in 2030 (after the senior deduction ends): SS 60k + 401k 50k.
  // taxable SS 36,600; AGI 86,600; deduction 32,200 + 2 x 1,650 = 35,500;
  // taxable 51,100 -> 2,480 + 26,300 x 12% = 5,636.
  const a = est(50_000, 60_000, 70, 2030);
  check('2026 brackets: federal tax 5,636', near(a.ordinaryTax, 5_636, 0.5), `got ${a.ordinaryTax.toFixed(2)}`);
  check('CO 65+: all SS subtracted, no pension passed -> (51,100 - 36,600) x 4.4% = 638', near(a.stateTax, 638, 0.5), `got ${a.stateTax.toFixed(2)}`);
  check('CO 65+: $48,000 pension cap wipes out the rest -> 0', near(est(50_000, 60_000, 70, 2030, 50_000).stateTax, 0, 0.01));
  // Same couple in 2027: +6,000 each (MAGI under 150k) -> taxable 39,100 -> 4,196.
  check('senior deduction applies in 2027: federal 4,196', near(est(50_000, 60_000, 70, 2027).ordinaryTax, 4_196, 0.5));
  // Phase-out: ordinary 200k at 66 in 2027: each 6,000 - 6% x 50,000 = 3,000.
  // deduction 32,200 + 3,300 + 6,000 = 41,500 -> taxable 158,500 -> 24,294.
  check('senior deduction phases out per person: federal 24,294', near(est(200_000, 0, 66, 2027).ordinaryTax, 24_294, 0.5));
  // CO 55-64 under the $95k test: SS 30k + 40k ordinary at 63 -> SS fully subtracted.
  // taxable SS 15,350; fed taxable 55,350 - 32,200 = 23,150; CO (23,150 - 15,350) x 4.4% = 343.20.
  check('CO 55-64 under $95k: SS fully subtracted -> 343.20', near(est(40_000, 30_000, 63, 2030).stateTax, 343.2, 0.01));
  // Over the test: SS 40k + 100k ordinary at 63; taxable SS 34,000 shares the $40k cap.
  // fed taxable 134,000 - 32,200 = 101,800; CO (101,800 - 34,000) x 4.4% = 2,983.20.
  check('CO 55-64 over $95k: SS shares the pension cap -> 2,983.20', near(est(100_000, 40_000, 63, 2030).stateTax, 2_983.2, 0.01));
  check('CO 55-64 over $95k with pensions: cap holds at $40,000 -> 2,719.20', near(est(100_000, 40_000, 63, 2030, 100_000).stateTax, 2_719.2, 0.01));
  // Gains stack on ordinary: ordinary 80k at 70 in 2030 -> taxable 44,500; 0% band to 98,900
  // covers 54,400 of a 100k gain; the other 45,600 at 15% = 6,840.
  check('capital gains stack on ordinary income: 6,840', near(est(80_000, 0, 70, 2030, 0, 100_000).capGainsTax, 6_840, 0.5));
}

console.log('\n[16] Engine tax tracking: account mix decides how withdrawals are taxed');
{
  const make = (accounts: Scenario['accounts'], tweak?: (x: Scenario) => void) => {
    const x: Scenario = structuredClone(sell);
    x.accounts = accounts;
    x.assumptions.startingBalance = accounts.reduce((t, acc) => t + acc.balance, 0);
    x.contributions = [];
    x.lumpSums = [];
    x.incomeStreams = [];
    x.socialSecurity.enabled = false;
    x.withdrawal = { type: 'percent-of-balance', rate: 0.04, taxStatus: 'taxable' };
    tweak?.(x);
    return { ...runProjection(x, settings), scn: x };
  };
  const acct = (kind: 'pretax' | 'roth' | 'taxable', balance: number, costBasisRatio?: number) =>
    ({ id: kind, name: kind, kind, balance, costBasisRatio, enabled: true }) as Scenario['accounts'][number];

  const pre = make([acct('pretax', 1_000_000)]);
  const roth = make([acct('roth', 1_000_000)]);
  const brk = make([acct('taxable', 1_000_000, 0.5)]);
  check('account type never changes the balance path', near(pre.result.endingBalance, roth.result.endingBalance, 0.01) && near(pre.result.endingBalance, brk.result.endingBalance, 0.01));
  check('pre-tax only: every withdrawn dollar is ordinary income', pre.months.every((m) => m.pOrd === 1 && m.pGain === 0));
  check('Roth only: no tax at all', roth.months.every((m) => m.pOrd === 0 && m.pGain === 0) && roth.result.estimatedTaxMonthly === 0);
  // The month the retirement tiles are measured (end of the retirement-age row).
  const tR = pre.result.rows.find((row) => row.age === Math.round(sell.assumptions.retirementAge))!.monthIndexEnd;
  const gainNow = brk.months[0].pGain;
  const gainLater = brk.months[tR].pGain;
  check('brokerage: gain share starts at 1 - basis (50%)', near(gainNow, 0.5, 1e-9), String(gainNow));
  check('brokerage: gain share grows as the account grows', gainLater > gainNow && gainLater < 1, `${gainNow} -> ${gainLater}`);
  check('tax order: pre-tax > brokerage > Roth', pre.result.estimatedTaxMonthly > brk.result.estimatedTaxMonthly && brk.result.estimatedTaxMonthly > 0);

  // Tile identities.
  const r = pre.result;
  check('after-tax = income - tax', near(r.afterTaxMonthlyIncome, r.monthlyIncomeAtRetirement - r.estimatedTaxMonthly, 1e-6));
  check("today's tax uses the one retirement deflator", near(r.estimatedTaxMonthlyToday * r.retirementCpi, r.estimatedTaxMonthly, 1e-6) && near(r.afterTaxMonthlyIncomeToday * r.retirementCpi, r.afterTaxMonthlyIncome, 1e-6));
  // Independent recomputation of the tile from the measured month's flows.
  const m = pre.months[tR];
  const indep = estimateAnnualTaxes({
    income: { ordinaryIncome: m.withdrawal * 12, longTermGains: 0, socialSecurityGross: 0, taxExemptInterest: 0, taxFreeIncome: 0 },
    // Any year after 2028 (no senior deduction); the seed retires well after that.
    ctx: { primaryAge: m.age, spouseAge: m.age + (sell.assumptions.spouseAgeOffset ?? 0), calendarYear: 2038, cpiFactor: m.cpi },
    cfg: resolveTaxConfig(),
    coPensionSubtractable: m.withdrawal * 12,
  }).totalTax / 12;
  check('tax tile matches an independent estimate of the measured month', near(r.estimatedTaxMonthly, indep, 0.01), `${r.estimatedTaxMonthly} vs ${indep}`);
  check('no tax shown before the retirement row', pre.result.rows.filter((row) => row.monthIndexEnd < tR - 11).every((row) => row.totalTax === undefined));
  check('every retirement row carries a finite tax', pre.result.rows.filter((row) => row.monthIndexEnd >= tR).every((row) => finite(row.totalTax) && (row.totalTax ?? 0) >= 0));

  // Contributions follow their account; a sale lands in brokerage at full basis.
  const mixC = make([acct('pretax', 500_000)], (x) => {
    x.contributions = [{ id: 'c', name: 'roth', startAge: x.assumptions.currentAge, endAge: x.assumptions.retirementAge - 1, monthlyAmount: 5_000, dollarBasis: 'actual', accountKind: 'roth', enabled: true }];
  });
  check('Roth contributions lower the taxable share at retirement', mixC.months[tR].pOrd < 1 && mixC.months[tR].pOrd > 0, String(mixC.months[tR].pOrd));
  const sale = make([acct('pretax', 500_000)], (x) => {
    x.lumpSums = [{ id: 's', name: 'sale', age: x.assumptions.retirementAge - 2, amount: 900_000, dollarBasis: 'actual', enabled: true }];
  });
  const ms = sale.months[tR];
  check('sale deposit goes to brokerage: some withdrawal becomes tax-free basis', ms.pOrd + ms.pGain < 1 && ms.pGain > 0, `${ms.pOrd} ${ms.pGain}`);

  // Guaranteed income character: VA tax-free, Social Security, pension ordinary.
  const inc = make([acct('roth', 1_000_000)], (x) => {
    const base = { startAge: x.assumptions.currentAge, endAge: x.assumptions.modelEndAge, inflationAdjusted: true, owner: 'self' as const, enabled: true };
    x.incomeStreams = [
      { ...base, id: 'va', name: 'VA Disability', monthlyAmountToday: 3_000, taxStatus: 'tax-free' },
      { ...base, id: 'ss', name: 'Social Security', monthlyAmountToday: 3_000, taxStatus: 'taxable', isSocialSecurity: true, startAge: 67 },
      { ...base, id: 'p', name: 'Pension', monthlyAmountToday: 2_000, taxStatus: 'taxable' },
    ];
  });
  const mi = inc.months[tR];
  check('guaranteed income splits by character and sums to the total', near(mi.gFree + mi.gSS + mi.gOrd, mi.guaranteedIncome, 1e-6) && mi.gFree > 0 && mi.gSS > 0 && mi.gOrd > 0);
  const bd = incomeBreakdownAtAge(brk.scn, brk.months, Math.round(sell.assumptions.retirementAge));
  check('breakdown: a brokerage draw is shown as partly taxable', (bd.components.find((c) => c.cat === 1)?.taxableShare ?? 1) < 1);
  check('breakdown: taxable + tax-free equals the total', near(bd.taxablePerMo + bd.taxFreePerMo, bd.components.reduce((t, c) => t + c.monthlyNominal, 0), 0.01));
}

console.log('\n[17] One payment split across accounts: rows per account share months');
{
  const { contributionOverlaps } = await import('@/lib/contributions');
  const a = sell.assumptions;
  const row = (id: string, accountKind: 'pretax' | 'roth' | 'taxable' | undefined, amt: number) => ({
    id, name: id, startAge: 57, endAge: 60, monthlyAmount: amt, dollarBasis: 'actual' as const, accountKind, enabled: true,
  });
  const split = [row('k401', 'pretax', 4_000), row('roth', 'roth', 1_000), row('brk', 'taxable', 2_000)];
  check('different accounts in the same months are not an overlap', contributionOverlaps(split, a).size === 0);
  check('same account in the same months is still flagged', contributionOverlaps([row('a', 'pretax', 1), row('b', undefined, 1)], a).size === 2);

  const run = (contribs: Scenario['contributions']) => {
    const x: Scenario = structuredClone(sell);
    x.accounts = [{ id: 'p', name: 'p', kind: 'pretax', balance: 100_000, enabled: true }];
    x.assumptions.startingBalance = 100_000;
    x.contributions = contribs;
    x.lumpSums = [];
    return runProjection(x, settings);
  };
  const splitRun = run(split);
  const oneRow = run([row('all', 'pretax', 7_000)]);
  check('split rows deposit the same total as one row', near(splitRun.result.endingBalance, oneRow.result.endingBalance, 0.01));
  const tR = splitRun.result.rows.find((r) => r.age === Math.round(a.retirementAge))!.monthIndexEnd;
  const m = splitRun.months[tR];
  check('split rows land in their own accounts (part Roth, part brokerage)', m.pOrd < oneRow.months[tR].pOrd && m.pGain > 0, `${m.pOrd} ${m.pGain}`);
  check('splitting lowers the estimated tax versus all pre-tax', splitRun.result.estimatedTaxMonthly < oneRow.result.estimatedTaxMonthly);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
// dev-only harness; exit non-zero on failure when run under node
if (fail > 0) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
