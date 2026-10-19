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

/**
 * Model month index of a calendar date.
 *
 * Model month t is an AGE month: it runs from the birthday's day-of-month in
 * one calendar month to the day before it in the next (born on the 28th: Sep 28
 * to Oct 27). It is labelled by the calendar month it starts in. A date earlier
 * in its calendar month than the birthday day therefore belongs to the model
 * month that began the PREVIOUS calendar month.
 *
 * That last step was missing. Payments land on the 1st (decision 5), so for any
 * birthday after the 1st every typed date landed one model month late: on Oct
 * 18 with a 28th birthday, an "October" payment fell in November's model month.
 */
export function dateToMonthIndex(
  iso: string,
  currentAge: number,
  birthYear: number,
  birthMonth: number,
  birthDay = 1,
): number {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  const currentYear = birthYear + Math.floor(currentAge);
  const currentMonth = birthMonth + Math.round((currentAge % 1) * 12);
  const idx = (d.getFullYear() - currentYear) * 12 + (d.getMonth() - currentMonth);
  return d.getDate() < birthDay ? idx - 1 : idx;
}
