import type { MonthlyContribution, ScenarioAssumptions } from '@/domain/types';
import { ageFromISO } from './dates';

/**
 * A contribution window as INTEGER month indices on the birth-anchored month
 * grid, end month inclusive. Each endpoint is snapped to its calendar month
 * independently (typed dates win over ages) — this is what the month inputs
 * display and what the engine pays, so counting on the same grid guarantees
 * that a row showing Jun -> Jun is 1 payment and Jul -> Aug is 2. Rounding the
 * DIFFERENCE of raw fractional ages must be avoided: an off-grid stored age
 * (e.g. from old seeded data) would make the count disagree with the dates.
 */
/**
 * Null when either endpoint is still blank. A half-filled row has no window, so
 * it pays nothing and — importantly — cannot be reported as overlapping
 * anything, which is what a guessed default date used to cause.
 */
export function contributionWindow(c: MonthlyContribution, a: ScenarioAssumptions): [number, number] | null {
  const s = c.startDateOverride ? ageFromISO(c.startDateOverride, a) : c.startAge;
  const e = c.endDateOverride ? ageFromISO(c.endDateOverride, a) : c.endAge;
  if (s == null || e == null) return null;
  return [Math.round(s * 12), Math.round(e * 12)];
}

/** Payments a contribution makes: one on the 1st of every month from the start
 *  month through the end month INCLUSIVE (Jun -> Jun = 1, Jul -> Aug = 2).
 *  Zero while the row is undated. */
export function contributionMonths(c: MonthlyContribution, a: ScenarioAssumptions): number {
  const w = contributionWindow(c, a);
  if (!w) return 0;
  const [s, e] = w;
  return e < s ? 0 : e - s + 1;
}

/** Total cash across all ENABLED contribution rows (months x monthly amount). */
export function totalContributed(contribs: MonthlyContribution[], a: ScenarioAssumptions): number {
  return contribs.filter((c) => c.enabled).reduce((sum, c) => sum + contributionMonths(c, a) * c.monthlyAmount, 0);
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
  // Undated rows are not on the timeline, so they cannot overlap anything.
  const en = contribs.filter((c) => c.enabled && contributionWindow(c, a));
  for (let i = 0; i < en.length; i++) {
    for (let j = i + 1; j < en.length; j++) {
      const [s1, e1] = contributionWindow(en[i], a)!;
      const [s2, e2] = contributionWindow(en[j], a)!;
      if (s1 <= e2 && s2 <= e1) {
        if (!out.has(en[i].id)) out.set(en[i].id, en[j].name);
        if (!out.has(en[j].id)) out.set(en[j].id, en[i].name);
      }
    }
  }
  return out;
}
