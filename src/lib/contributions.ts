import type { MonthlyContribution, ScenarioAssumptions } from '@/domain/types';
import { ageFromISO } from './dates';

/** Effective [start, end] window in age terms (end month inclusive); typed dates win over ages. */
function window(c: MonthlyContribution, a: ScenarioAssumptions): [number, number] {
  const s = c.startDateOverride ? ageFromISO(c.startDateOverride, a) : c.startAge;
  const e = c.endDateOverride ? ageFromISO(c.endDateOverride, a) : c.endAge;
  return [s, e];
}

/** Payments a contribution makes: one on the 1st of every month from the start
 *  month through the end month INCLUSIVE (Jul -> Aug = 2). Ages are authoritative;
 *  kept in sync with dates. */
export function contributionMonths(c: MonthlyContribution): number {
  const span = Math.round((c.endAge - c.startAge) * 12);
  return span < 0 ? 0 : span + 1;
}

/** Total cash across all ENABLED contribution rows (months x monthly amount). */
export function totalContributed(contribs: MonthlyContribution[]): number {
  return contribs.filter((c) => c.enabled).reduce((sum, c) => sum + contributionMonths(c) * c.monthlyAmount, 0);
}

/**
 * Detect overlapping contribution periods: months covered by two enabled rows
 * would count BOTH amounts, which is almost always accidental double-counting.
 * End months PAY, so a row ending in the month the next one starts overlaps it;
 * sequential rows start the month after the previous one ends.
 * Returns id -> the other row's name.
 */
export function contributionOverlaps(contribs: MonthlyContribution[], a: ScenarioAssumptions): Map<string, string> {
  const out = new Map<string, string>();
  const en = contribs.filter((c) => c.enabled);
  const M = 1 / 12; // the end month itself pays, so the window extends one month past the end date
  const EPS = 1 / 24; // half a month of tolerance so touching boundaries stay clean
  for (let i = 0; i < en.length; i++) {
    for (let j = i + 1; j < en.length; j++) {
      const [s1, e1] = window(en[i], a);
      const [s2, e2] = window(en[j], a);
      if (s1 < e2 + M - EPS && s2 < e1 + M - EPS) {
        if (!out.has(en[i].id)) out.set(en[i].id, en[j].name);
        if (!out.has(en[j].id)) out.set(en[j].id, en[i].name);
      }
    }
  }
  return out;
}
