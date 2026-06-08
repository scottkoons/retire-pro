import type { PresetKey, Rate, Scenario } from './types';
import { newId } from './ids';

export interface PresetDelta {
  name: string;
  annualReturn: Rate;
  withdrawalRate: Rate;
  returnVolatility: Rate;
  inflation: Rate;
}

export const PRESETS: Record<PresetKey, PresetDelta> = {
  conservative: {
    name: 'Conservative',
    annualReturn: 0.05,
    withdrawalRate: 0.035,
    returnVolatility: 0.09,
    inflation: 0.03,
  },
  moderate: {
    name: 'Moderate',
    annualReturn: 0.074,
    withdrawalRate: 0.04,
    returnVolatility: 0.12,
    inflation: 0.025,
  },
  aggressive: {
    name: 'Aggressive',
    annualReturn: 0.09,
    withdrawalRate: 0.045,
    returnVolatility: 0.16,
    inflation: 0.022,
  },
};

/** Apply a preset's four levers onto a scenario, preserving household facts. */
export function applyPreset(s: Scenario, key: PresetKey, now: string): Scenario {
  const p = PRESETS[key];
  return {
    ...s,
    presetKey: key,
    assumptions: {
      ...s.assumptions,
      annualReturn: p.annualReturn,
      inflation: p.inflation,
    },
    withdrawal: { ...s.withdrawal, type: 'percent-of-balance', rate: p.withdrawalRate },
    monteCarlo: { ...(s.monteCarlo ?? {}), returnVolatility: p.returnVolatility },
    updatedAt: now,
  };
}

/** Deep clone a scenario, regenerating every id so it is fully independent. */
export function cloneScenario(src: Scenario, name: string, now: string): Scenario {
  const c: Scenario = structuredClone(src);
  c.id = newId();
  c.name = name;
  c.createdAt = now;
  c.updatedAt = now;
  c.contributions = c.contributions.map((x) => ({ ...x, id: newId() }));
  c.lumpSums = c.lumpSums.map((x) => ({ ...x, id: newId() }));
  c.incomeStreams = c.incomeStreams.map((x) => ({ ...x, id: newId() }));
  c.retirementPhases = c.retirementPhases.map((x) => ({ ...x, id: newId() }));
  c.investmentReturnPhases = c.investmentReturnPhases.map((x) => ({ ...x, id: newId() }));
  // v2 arrays must also get fresh ids so clones are fully independent.
  c.accounts = c.accounts.map((x) => ({ ...x, id: newId() }));
  c.expenses = c.expenses.map((x) => ({ ...x, id: newId() }));
  c.socialSecurity = { ...c.socialSecurity, claims: c.socialSecurity.claims.map((x) => ({ ...x })) };
  if (c.home.extraPrincipalPayments) c.home.extraPrincipalPayments = c.home.extraPrincipalPayments.map((x) => ({ ...x, id: newId() }));
  if (c.liabilities) c.liabilities = c.liabilities.map((x) => ({ ...x, id: newId() }));
  return c;
}
