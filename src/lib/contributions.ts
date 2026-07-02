import type { MonthlyContribution, ScenarioAssumptions } from '@/domain/types';
import { ageFromISO } from './dates';

/** Effective [start, end) window in age terms; typed dates win over ages. */
function window(c: MonthlyContribution, a: ScenarioAssumptions): [number, number] {
  const s = c.startDateOverride ? ageFromISO(c.startDateOverride, a) : c.startAge;
  const e = c.endDateOverride ? ageFromISO(c.endDateOverride, a) : c.endAge;
  return [s, e];
}

/**
 * Detect overlapping contribution periods: months covered by two enabled rows
 * would count BOTH amounts, which is almost always accidental double-counting.
 * A row ending exactly where the next begins is sequential, not overlapping
 * (the end month belongs to the next row). Returns id -> the other row's name.
 */
export function contributionOverlaps(contribs: MonthlyContribution[], a: ScenarioAssumptions): Map<string, string> {
  const out = new Map<string, string>();
  const en = contribs.filter((c) => c.enabled);
  const EPS = 1 / 24; // half a month of tolerance so touching boundaries stay clean
  for (let i = 0; i < en.length; i++) {
    for (let j = i + 1; j < en.length; j++) {
      const [s1, e1] = window(en[i], a);
      const [s2, e2] = window(en[j], a);
      if (s1 < e2 - EPS && s2 < e1 - EPS) {
        if (!out.has(en[i].id)) out.set(en[i].id, en[j].name);
        if (!out.has(en[j].id)) out.set(en[j].id, en[i].name);
      }
    }
  }
  return out;
}
