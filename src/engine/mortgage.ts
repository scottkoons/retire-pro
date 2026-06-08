// Pure mortgage amortization for the Home & Mortgage UI. Monthly schedule with
// recurring and one-time extra principal, plus payoff and interest summaries.

export interface AmortInputs {
  balance: number;
  annualRate: number;
  termYears: number;
  extraMonthly?: number; // recurring extra principal per month
  extraLumps?: { monthIndex: number; amount: number }[]; // one-time, at a 0-based month index
}

export interface AmortMonth {
  month: number; // 1-based
  payment: number; // scheduled P&I (interest + scheduled principal)
  interest: number;
  principal: number; // scheduled principal
  extra: number; // extra principal applied this month
  balance: number; // ending balance
}

export interface AmortResult {
  monthlyPayment: number; // scheduled P&I
  schedule: AmortMonth[];
  payoffMonths: number;
  totalInterest: number;
  totalPaid: number; // interest + all principal (incl. extra)
}

/** Standard fully-amortizing monthly payment. */
export function monthlyPaymentFor(balance: number, annualRate: number, termYears: number): number {
  if (balance <= 0 || termYears <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.round(termYears * 12);
  if (r === 0) return balance / n;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

export function amortize(inp: AmortInputs): AmortResult {
  const extraMonthly = Math.max(0, inp.extraMonthly ?? 0);
  const lumps = inp.extraLumps ?? [];
  const r = inp.annualRate / 12;
  const pmt = monthlyPaymentFor(inp.balance, inp.annualRate, inp.termYears);

  const schedule: AmortMonth[] = [];
  let bal = inp.balance;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const maxMonths = Math.round(inp.termYears * 12) + 1200; // safety cap so a degenerate input cannot loop forever

  for (let m = 1; bal > 0.005 && m <= maxMonths; m++) {
    const interest = bal * r;
    let principal = Math.min(bal, pmt - interest);
    if (principal < 0) principal = 0; // payment below interest (no negative amortization here)
    bal -= principal;

    let extra = bal > 0 ? extraMonthly : 0;
    for (const l of lumps) if (l.monthIndex === m - 1) extra += l.amount;
    extra = Math.min(bal, Math.max(0, extra));
    bal -= extra;

    totalInterest += interest;
    totalPrincipal += principal + extra;
    schedule.push({ month: m, payment: interest + principal, interest, principal, extra, balance: Math.max(0, bal) });
  }

  return {
    monthlyPayment: pmt,
    schedule,
    payoffMonths: schedule.length,
    totalInterest,
    totalPaid: totalInterest + totalPrincipal,
  };
}

export interface AmortYear {
  yearIndex: number; // 0-based from now
  interest: number;
  principal: number; // scheduled principal
  extra: number;
  paid: number; // scheduled P&I + extra
  endingBalance: number;
}

/** Aggregate a monthly schedule into year buckets for a compact table. */
export function byYear(result: AmortResult): AmortYear[] {
  const years: AmortYear[] = [];
  result.schedule.forEach((mo, i) => {
    const yi = Math.floor(i / 12);
    let y = years[yi];
    if (!y) {
      y = { yearIndex: yi, interest: 0, principal: 0, extra: 0, paid: 0, endingBalance: 0 };
      years[yi] = y;
    }
    y.interest += mo.interest;
    y.principal += mo.principal;
    y.extra += mo.extra;
    y.paid += mo.payment + mo.extra;
    y.endingBalance = mo.balance;
  });
  return years;
}
