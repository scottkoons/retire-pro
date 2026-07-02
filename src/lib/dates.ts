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

/**
 * Fractional age (whole-month precision) from a birth date, as of `now`.
 * Keeps the model anchored to today instead of a hand-typed static age.
 */
export function ageFromBirthDate(birthYear: number, birthMonth: number, birthDay: number, now = new Date()): number {
  let months = (now.getFullYear() - birthYear) * 12 + (now.getMonth() - birthMonth);
  if (now.getDate() < birthDay) months -= 1;
  return Math.max(0, Math.min(130, months / 12));
}

/** "yyyy-mm-dd" for <input type="date"> from the stored birth fields. */
export function birthDateISO(a: { birthYear: number; birthMonth: number; birthDay: number }): string {
  const m = String(a.birthMonth + 1).padStart(2, '0');
  const d = String(a.birthDay).padStart(2, '0');
  return `${a.birthYear}-${m}-${d}`;
}

export function fmtMonthYear(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
