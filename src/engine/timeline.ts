export function monthIndexToAge(t: number, currentAge: number): number {
  return currentAge + t / 12;
}

export function ageToMonthIndex(age: number, currentAge: number): number {
  return Math.round((age - currentAge) * 12);
}

/** Convert annual rate to its exact geometric monthly equivalent. */
export function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Month index of an ISO date relative to the birth-derived current month. */
export function dateToMonthIndex(iso: string, currentAge: number, birthYear: number, birthMonth: number): number {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  const currentYear = birthYear + Math.floor(currentAge);
  const currentMonth = birthMonth + Math.round((currentAge % 1) * 12);
  return (d.getFullYear() - currentYear) * 12 + (d.getMonth() - currentMonth);
}
