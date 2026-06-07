import type { ScenarioAssumptions } from '@/domain/types';
import { dateToMonthIndex } from '@/engine/timeline';

/** ISO yyyy-mm-01 corresponding to a given age, using the birth anchor. */
export function isoFromAge(age: number, a: ScenarioAssumptions): string {
  const whole = Math.floor(age);
  const months = Math.round((age - whole) * 12);
  const d = new Date(a.birthYear + whole, a.birthMonth + months, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Fractional age implied by an ISO date (consistent with the engine's month index). */
export function ageFromISO(iso: string, a: ScenarioAssumptions): number {
  return a.currentAge + dateToMonthIndex(iso, a.currentAge, a.birthYear, a.birthMonth) / 12;
}

/** "yyyy-mm" value for <input type="month"> from a stored ISO date. */
export function monthValueFromISO(iso?: string): string {
  return iso ? iso.slice(0, 7) : '';
}

/** ISO yyyy-mm-01 from an <input type="month"> "yyyy-mm" value (day assumed the 1st). */
export function isoFromMonthValue(v: string): string {
  return v ? `${v}-01` : '';
}

/** The stored ISO date for a contribution/lump, falling back to the age-derived date. */
export function effectiveISO(dateOverride: string | undefined, age: number, a: ScenarioAssumptions): string {
  return dateOverride ?? isoFromAge(age, a);
}

export function fmtMonthYear(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
