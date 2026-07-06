import type { MonthlyContribution, LumpSumEvent, Scenario } from '@/domain/types';
import { ageFromISO } from '@/lib/dates';

/**
 * What-If Explorer inputs. Sale timing is a calendar YEAR (Scott thinks in
 * "sell in '32"); the event lands on July 1 of that year. Contribution tiers
 * are tied to OWNERSHIP STATE, not dates: `both` while both restaurants are
 * owned, `one` after the first cash-out, `none` after both. Contributions
 * always stop at retirement.
 */
export interface SaleInput {
  cashOut: boolean;
  year: number;
  amount: number;
}

export interface WhatIfInputs {
  retirementAge: number;
  roundhouse: SaleInput;
  interquest: SaleInput;
  contribBoth: number;
  contribOne: number;
  contribNone: number;
}

const M = 1 / 12;

/** Engine age for a sale year (July 1 of that year, clamped to now). */
export function saleAge(year: number, a: Scenario['assumptions']): number {
  return Math.max(a.currentAge, ageFromISO(`${year}-07-01`, a));
}

/**
 * Build the in-memory scenario the What-If page projects. Starts from the
 * active scenario (keeps household facts, accounts, income streams, Social
 * Security, phases, withdrawal strategy) and REPLACES contributions and lump
 * sums with the slider-derived ones, so the quick estimate models exactly the
 * events shown on screen and nothing else.
 */
export function buildWhatIfScenario(base: Scenario, inputs: WhatIfInputs): Scenario {
  const scn: Scenario = structuredClone(base);
  const a = scn.assumptions;
  a.retirementAge = inputs.retirementAge;
  scn.name = whatIfName(inputs);
  scn.presetKey = undefined;
  scn.kind = undefined;

  // ---- cash-out events -> lump sums ----
  const sales: { label: string; input: SaleInput }[] = [
    { label: 'Roundhouse', input: inputs.roundhouse },
    { label: 'Interquest', input: inputs.interquest },
  ];
  const lumps: LumpSumEvent[] = [];
  const eventAges: number[] = [];
  for (const s of sales) {
    if (!s.input.cashOut) continue;
    const age = saleAge(s.input.year, a);
    eventAges.push(age);
    lumps.push({
      id: `whatif-${s.label.toLowerCase()}`,
      name: `${s.label} sale/dissolution`,
      age,
      amount: s.input.amount,
      dollarBasis: 'actual',
      enabled: true,
      dateOverride: `${s.input.year}-07-01`,
    });
  }
  scn.lumpSums = lumps;

  // ---- ownership-state contribution tiers ----
  // Boundaries walk currentAge -> first event -> second event -> retirement.
  // Each window is [boundary, next boundary - 1 month] (end months PAY, so
  // back-to-back tiers must not share a month), clamped to end at retirement.
  eventAges.sort((x, y) => x - y);
  const tiers = [inputs.contribBoth, inputs.contribOne, inputs.contribNone];
  const names = ['While owning both', 'After first cash-out', 'After both cash-outs'];
  const bounds = [a.currentAge, ...eventAges, inputs.retirementAge];
  const rows: MonthlyContribution[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = Math.min(bounds[i + 1], inputs.retirementAge) - M;
    if (end < start - 1e-9 || start >= inputs.retirementAge - 1e-9) continue;
    if (tiers[i] <= 0) continue;
    rows.push({
      id: `whatif-tier-${i}`,
      name: eventAges.length === 0 ? 'Monthly contribution' : names[i],
      startAge: start,
      endAge: end,
      monthlyAmount: tiers[i],
      dollarBasis: 'today',
      enabled: true,
    });
  }
  scn.contributions = rows;

  return scn;
}

/** Short descriptive name for the generated scenario. */
export function whatIfName(inputs: WhatIfInputs): string {
  const part = (label: string, s: SaleInput) => (s.cashOut ? `${label} '${String(s.year).slice(2)}` : `keep ${label}`);
  return `What-If: ${part('RH', inputs.roundhouse)}, ${part('IQ', inputs.interquest)}, retire ${Math.round(inputs.retirementAge)}`;
}
