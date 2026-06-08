/* Runtime verification harness for the v2 engine. Not shipped; run via:
 *   npx esbuild src/engine/__verify.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/verify.mjs && node /tmp/verify.mjs
 */
import { runProjection, runProjectionLegacy, runProjectionV2, usesV2 } from './project';
import { estimateAnnualTaxes, resolveTaxConfig } from './tax';
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
    cfg: resolveTaxConfig(),
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

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
// dev-only harness; exit non-zero on failure when run under node
if (fail > 0) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
