import type { TaxableIncomeInputs, TaxContext } from './types';
import type { TaxConfig } from './config';
import { estimateAnnualTaxes } from './estimate';

export interface GrossUpSource {
  character: 'ordinary' | 'ltcg' | 'taxFree';
  capacity: number; // max gross drawable from this source this year
  gainRatio?: number; // ltcg: fraction of the draw that is realized gain (default 1)
}

export interface GrossUpRequest {
  netNeed: number; // net after-tax dollars still needed after guaranteed income
  baseIncome: TaxableIncomeInputs; // fixed income already in the year (SS, RMD, interest)
  ctx: TaxContext;
  cfg: TaxConfig;
  sources: GrossUpSource[]; // in withdrawal-priority order; capacities cap each
  coPensionSubtractable?: number;
  maxIters?: number;
  tol?: number;
}

export interface GrossUpResult {
  gross: number;
  draws: number[]; // per-source gross draw, aligned to request.sources
  taxOnWithdrawal: number;
  net: number;
  shortfall: number; // > 0 means the net need was NOT fully met (check this, not converged)
  iterations: number;
  converged: boolean; // true only when the net need was met within tol
  capacityLimited: boolean; // true when sources were exhausted before meeting the need
}

function netFromGross(gross: number, req: GrossUpRequest, baseTax: number): { net: number; tax: number; draws: number[] } {
  const draws: number[] = [];
  let remaining = gross;
  let addOrdinary = 0;
  let addGains = 0;
  for (const s of req.sources) {
    const take = Math.max(0, Math.min(remaining, s.capacity));
    draws.push(take);
    remaining -= take;
    if (s.character === 'ordinary') addOrdinary += take;
    else if (s.character === 'ltcg') addGains += take * (s.gainRatio ?? 1);
  }
  const income: TaxableIncomeInputs = {
    ...req.baseIncome,
    ordinaryIncome: req.baseIncome.ordinaryIncome + addOrdinary,
    longTermGains: req.baseIncome.longTermGains + addGains,
  };
  const r = estimateAnnualTaxes({ income, ctx: req.ctx, cfg: req.cfg, coPensionSubtractable: req.coPensionSubtractable });
  const tax = r.totalTax - baseTax;
  return { net: gross - tax, tax, draws };
}

/** Solve the gross withdrawal so net-after-tax meets netNeed. Fixed-point + bisection fallback. */
export function solveGrossWithdrawal(req: GrossUpRequest): GrossUpResult {
  const maxIters = req.maxIters ?? 25;
  const tol = req.tol ?? 1;
  const totalCapacity = req.sources.reduce((s, x) => s + x.capacity, 0);

  const base = estimateAnnualTaxes({ income: req.baseIncome, ctx: req.ctx, cfg: req.cfg, coPensionSubtractable: req.coPensionSubtractable });
  const baseTax = base.totalTax;

  if (req.netNeed <= 0) {
    return { gross: 0, draws: req.sources.map(() => 0), taxOnWithdrawal: 0, net: 0, shortfall: 0, iterations: 0, converged: true, capacityLimited: false };
  }

  let gross = Math.min(req.netNeed, totalCapacity);
  let last = netFromGross(gross, req, baseTax);
  let iter = 0;
  for (; iter < maxIters; iter++) {
    const err = req.netNeed - last.net;
    if (Math.abs(err) <= tol) break;
    let next = gross + err; // under-steps (1 < 1/(1-marginal)) so it is monotone, no overshoot
    next = Math.min(next, totalCapacity);
    if (next === gross) break; // capacity-pinned
    gross = next;
    last = netFromGross(gross, req, baseTax);
  }

  const capacityPinned = gross >= totalCapacity - tol;
  // Only bisect when there is room to search (not capacity-pinned) and we have not met the need.
  if (Math.abs(req.netNeed - last.net) > tol && !capacityPinned) {
    let lo = 0;
    let hi = totalCapacity;
    let mid = gross;
    let r = last;
    for (let b = 0; b < 60; b++) {
      mid = (lo + hi) / 2;
      r = netFromGross(mid, req, baseTax);
      if (Math.abs(req.netNeed - r.net) <= tol) break;
      if (r.net < req.netNeed) lo = mid;
      else hi = mid;
    }
    gross = mid;
    last = r;
  }

  const shortfall = Math.max(0, req.netNeed - last.net);
  return {
    gross,
    draws: last.draws,
    taxOnWithdrawal: last.tax,
    net: last.net,
    shortfall,
    iterations: iter,
    converged: shortfall <= tol, // true ONLY when the need is actually met
    capacityLimited: shortfall > tol, // sources exhausted before meeting the need
  };
}
