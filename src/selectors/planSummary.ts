import type { DisplayMode, ProjectionResult, Scenario } from '@/domain/types';
import type { MonteCarloResult } from '@/engine/montecarlo/types';

export interface PlanSummaryModel {
  scenarioName: string;
  household: string;
  generatedOn: string;
  displayMode: DisplayMode;
  assumptions: {
    currentAge: number;
    retireAge: number;
    modelEndAge: number;
    annualReturn: number;
    inflation: number;
    startingBalance: number;
    withdrawal: string;
  };
  keyResults: {
    balanceAtRetirement: number;
    monthlyIncome: number;
    annualIncome: number;
    guaranteedMonthly: number;
    requiredWithdrawal: number;
    status: ProjectionResult['status'];
    depletionAge: number | null;
  };
  contributions: { name: string; start: number; end: number; monthly: number; months: number; total: number }[];
  lumpSums: { name: string; age: number; amount: number }[];
  incomeStreams: { name: string; today: number; start: number; end: number; cola: number; tax: string; atRetire: number }[];
  spendingPhases: { name: string; start: number; end: number; target: number }[];
  returnPhases: { name: string; start: number; end: number; ret: number; vol: number }[];
  monteCarlo: {
    ran: boolean;
    paths: number;
    success: number;
    p10: number;
    p50: number;
    p90: number;
    medianFailureAge: number | null;
  };
}

function streamNominal(today: number, cola: number, infl: boolean, delta: number): number {
  return infl ? today * Math.pow(1 + cola, delta) : today;
}

export function buildPlanSummaryModel(
  scn: Scenario,
  result: ProjectionResult,
  mc: MonteCarloResult | null,
  displayMode: DisplayMode,
  household: string,
): PlanSummaryModel {
  const a = scn.assumptions;
  const wd =
    scn.withdrawal.type === 'percent-of-balance'
      ? `Percentage of balance, ${((scn.withdrawal.rate ?? 0.04) * 100).toFixed(1)}%, ${scn.withdrawal.taxStatus}`
      : scn.withdrawal.type === 'fixed-amount'
        ? `Fixed ${scn.withdrawal.amount ?? 0}/yr, ${scn.withdrawal.taxStatus}`
        : `Target income (phases), ${scn.withdrawal.taxStatus}`;

  return {
    scenarioName: scn.name,
    household,
    generatedOn: new Date().toISOString().slice(0, 10),
    displayMode,
    assumptions: {
      currentAge: a.currentAge,
      retireAge: a.retirementAge,
      modelEndAge: a.modelEndAge,
      annualReturn: a.annualReturn,
      inflation: a.inflation,
      startingBalance: a.startingBalance,
      withdrawal: wd,
    },
    keyResults: {
      balanceAtRetirement: displayMode === 'today' ? result.projectedBalanceAtRetirementToday : result.projectedBalanceAtRetirement,
      monthlyIncome: result.monthlyIncomeAtRetirement,
      annualIncome: result.annualIncomeAtRetirement,
      guaranteedMonthly: result.guaranteedMonthlyIncome,
      requiredWithdrawal: result.requiredPortfolioWithdrawal,
      status: result.status,
      depletionAge: result.depletionAge,
    },
    contributions: scn.contributions
      .filter((c) => c.enabled)
      .map((c) => {
        const months = Math.max(0, Math.round((c.endAge - c.startAge) * 12));
        return { name: c.name, start: c.startAge, end: c.endAge, monthly: c.monthlyAmount, months, total: months * c.monthlyAmount };
      }),
    lumpSums: scn.lumpSums.filter((l) => l.enabled).map((l) => ({ name: l.name, age: l.age, amount: l.amount })),
    incomeStreams: scn.incomeStreams
      .filter((st) => st.enabled)
      .map((st) => ({
        name: st.name,
        today: st.monthlyAmountToday,
        start: st.startAge,
        end: st.endAge,
        cola: st.cola ?? a.inflation,
        tax: st.taxStatus,
        atRetire: streamNominal(st.monthlyAmountToday, st.cola ?? a.inflation, st.inflationAdjusted, a.retirementAge - a.currentAge),
      })),
    spendingPhases: scn.retirementPhases.filter((p) => p.enabled).map((p) => ({ name: p.name, start: p.startAge, end: p.endAge, target: p.targetMonthlyIncome })),
    returnPhases: scn.investmentReturnPhases.filter((p) => p.enabled).map((p) => ({ name: p.name, start: p.startAge, end: p.endAge, ret: p.expectedReturn, vol: p.volatility })),
    monteCarlo: mc
      ? {
          ran: true,
          paths: mc.paths,
          success: mc.successProbability,
          p10: mc.endingPercentiles.p10,
          p50: mc.endingPercentiles.p50,
          p90: mc.endingPercentiles.p90,
          medianFailureAge: mc.medianFailureAge,
        }
      : { ran: false, paths: 0, success: 0, p10: 0, p50: 0, p90: 0, medianFailureAge: null },
  };
}
