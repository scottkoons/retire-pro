// ============================================================================
// Plan checkup selector — a pure, defensive pass over the projection that
// surfaces actionable insights (depletion, Monte Carlo health, Roth-conversion
// windows, IRMAA cliffs, and unmodeled long-term-care exposure).
// No JSX, no React; safe to call from anywhere (UI, PDF, tests).
// ============================================================================

import type { YearRow, ProjectionResult, Scenario, Settings } from '@/domain/types';
import { resolveTaxConfig } from '@/engine/tax';
import { fmtAgeYM } from '@/lib/format';

export interface Insight {
  id: string;
  severity: 'info' | 'caution' | 'warning';
  title: string;
  detail: string;
}

// Severity ordering for the final sort (most severe first).
const SEVERITY_RANK: Record<Insight['severity'], number> = {
  warning: 0,
  caution: 1,
  info: 2,
};

// ----- small formatting helpers (kept local; this module stays JSX-free) -----
function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Rule 1 — portfolio depletes before the end of the plan. */
function ruleDepletion(result: ProjectionResult): Insight | null {
  const age = result.depletionAge;
  if (age == null) return null;
  return {
    id: 'depletion',
    severity: 'warning',
    title: `Portfolio depletes at ${fmtAgeYM(age)}`,
    detail:
      `Invested assets run dry at ${fmtAgeYM(age)}. After that point the plan can no longer ` +
      `fully fund the requested spending from the portfolio, leaving a gap covered only ` +
      `by guaranteed income.`,
  };
}

/** Rule 2 — Monte Carlo success probability health check. */
function ruleMonteCarlo(mcSuccess?: number): Insight | null {
  if (mcSuccess == null) return null;
  const shown = Math.round(mcSuccess * 100);
  if (mcSuccess < 0.7) {
    return {
      id: 'monte-carlo',
      severity: 'warning',
      title: `Low Monte Carlo success (${shown}%)`,
      detail:
        `Only ${shown}% of simulated market paths keep the portfolio solvent through the ` +
        `end of the plan. Consider trimming spending, delaying retirement, or reducing ` +
        `sequence-of-returns risk.`,
    };
  }
  if (mcSuccess < 0.85) {
    return {
      id: 'monte-carlo',
      severity: 'caution',
      title: `Moderate Monte Carlo success (${shown}%)`,
      detail:
        `${shown}% of simulated market paths succeed. The plan is workable but sensitive to ` +
        `poor early returns; modest spending flexibility would strengthen the outlook.`,
    };
  }
  return {
    id: 'monte-carlo',
    severity: 'info',
    title: `Healthy Monte Carlo success (${shown}%)`,
    detail:
      `${shown}% of simulated market paths keep the portfolio funded through the end of the ` +
      `plan, indicating a resilient strategy across a wide range of market outcomes.`,
  };
}

/**
 * Rule 3 — Roth conversion window.
 * Look for retirement years before RMDs begin where the marginal rate is low and
 * a sizeable pre-tax balance remains to convert.
 */
function ruleRothWindow(rows: YearRow[], scn: Scenario, settings: Settings): Insight | null {
  const retireAge = scn.assumptions.retirementAge;
  const rmdStart = settings.rmdStartAge;

  const windowRows = rows.filter(
    (r) =>
      r.age >= retireAge &&
      r.age < rmdStart &&
      (r.marginalRate ?? 0) <= 0.12 &&
      (r.accountBalances?.pretax ?? 0) > 250_000,
  );
  if (windowRows.length === 0) return null;

  const startAge = windowRows[0].age;
  const endAge = windowRows[windowRows.length - 1].age;
  // Use the largest pre-tax balance seen across the window as the headline figure.
  const pretax = windowRows.reduce((max, r) => Math.max(max, r.accountBalances?.pretax ?? 0), 0);

  return {
    id: 'roth-window',
    severity: 'info',
    title: `Roth conversion window (ages ${startAge}–${endAge})`,
    detail:
      `Between ages ${startAge} and ${endAge}, marginal income tax sits at or below 12% while ` +
      `roughly ${money(pretax)} remains in pre-tax accounts. Converting pre-tax dollars to Roth ` +
      `up to the top of the 12% or 22% bracket during these low-income years can shrink future ` +
      `required minimum distributions and reduce lifetime IRMAA Medicare surcharges.`,
  };
}

/**
 * Rule 4 — IRMAA cliff.
 * At Medicare ages (65+), each IRMAA tier ceiling is inflated to the modeled year.
 * If MAGI lands within 5% just below any real tier ceiling, the household is one
 * small income increase away from a higher Medicare premium bracket.
 */
function ruleIrmaaCliff(rows: YearRow[], settings: Settings): Insight | null {
  const cfg = resolveTaxConfig({ rmdStartAge: settings.rmdStartAge });

  for (const r of rows) {
    if (r.age < 65) continue;
    const magi = r.magi ?? 0;
    if (magi <= 0) continue;

    // Inflate tier ceilings from the config base year to this row's calendar year.
    const yearsOut = Math.max(0, r.year - cfg.baseYear);
    const growth = Math.pow(1 + cfg.irmaaMedicalInflation, yearsOut);

    for (const tier of cfg.irmaaTiers) {
      if (tier.magiUpTo == null) continue; // open-ended top tier has no cliff above it
      const ceiling = tier.magiUpTo * growth;
      // Within 5% below the ceiling (and not over it) == sitting on the cliff edge.
      if (magi <= ceiling && magi >= ceiling * 0.95) {
        return {
          id: 'irmaa-cliff',
          severity: 'caution',
          title: `Near an IRMAA cliff around age ${r.age}`,
          detail:
            `At age ${r.age}, modified AGI of ${money(magi)} is within 5% of an IRMAA tier ceiling ` +
            `near ${money(ceiling)}. A small income increase would cross into higher Medicare Part B ` +
            `premiums for both spouses. Managing MAGI through Roth conversions or a different ` +
            `withdrawal mix can keep premiums in the lower bracket.`,
        };
      }
    }
  }
  return null;
}

/** Rule 5 — long-term care is left unmodeled (LTC stress test disabled). */
function ruleLtcExposure(scn: Scenario): Insight | null {
  const ltc = scn.longTermCare;
  if (!ltc || ltc.crissyEnabled !== false) return null;

  const exposure = (ltc.monthly ?? 0) * 12 * (ltc.years ?? 0);
  return {
    id: 'ltc-exposure',
    severity: 'caution',
    title: 'Long-term care is unmodeled',
    detail:
      `The plan does not currently fund long-term care. A potential ${money(exposure)} in today's ` +
      `dollars (${money(ltc.monthly ?? 0)}/mo for ${ltc.years ?? 0} years, beginning at ` +
      `${fmtAgeYM(ltc.startAge ?? 0)}) sits outside the projection as an unaddressed stress. Enabling the LTC ` +
      `stress test will show how this cost affects portfolio longevity.`,
  };
}

/**
 * Run every checkup rule, dropping nulls, and return the insights ordered
 * most-severe first (warning -> caution -> info).
 */
export function planCheckup(args: {
  rows: YearRow[];
  result: ProjectionResult;
  scn: Scenario;
  settings: Settings;
  mcSuccess?: number;
}): Insight[] {
  const { rows, result, scn, settings, mcSuccess } = args;
  const safeRows = rows ?? [];

  const candidates: (Insight | null)[] = [
    ruleDepletion(result),
    ruleMonteCarlo(mcSuccess),
    ruleRothWindow(safeRows, scn, settings),
    ruleIrmaaCliff(safeRows, settings),
    ruleLtcExposure(scn),
  ];

  return candidates
    .filter((i): i is Insight => i != null)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
