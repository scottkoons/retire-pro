import { runProjection, type ReturnProvider } from '../project';
import { mulberry32, sampleAnnualReturn } from './prng';
import type {
  EndingHistogramBin,
  EndingPercentiles,
  FailureAgeBin,
  MonteCarloRequest,
  MonteCarloResult,
  PercentilePoint,
} from './types';
import { fmtUSDAbbrev } from '@/lib/format';

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

/** Stochastic provider: one lognormal draw per year, applied to all 12 months. */
function makeProvider(rng: () => number, fallbackVol: number): ReturnProvider {
  let lastYear = -1;
  let lastVal = 0;
  return ({ yearIndex, expectedReturn, volatility }) => {
    if (yearIndex !== lastYear) {
      lastYear = yearIndex;
      lastVal = sampleAnnualReturn(rng, expectedReturn, volatility || fallbackVol);
    }
    return lastVal;
  };
}

export function runMonteCarlo(
  req: MonteCarloRequest,
  onProgress?: (completed: number, total: number) => void,
): MonteCarloResult {
  const { scenario, settings, paths, volatilityFallback, seed, criterion } = req;
  const a = scenario.assumptions;
  const years = Math.max(1, Math.round(a.modelEndAge - a.currentAge + 1));

  // Per-year nominal balances across paths, plus the deterministic cpi per year.
  const yearBalances: number[][] = Array.from({ length: years }, () => []);
  const cpiByYear: number[] = [];
  const endingToday: number[] = [];
  const failureAgeCounts = new Map<number, number>();
  let successCount = 0;

  const progressEvery = Math.max(1, Math.floor(paths / 100));

  for (let p = 0; p < paths; p++) {
    const rng = mulberry32((seed + p * 2654435761) >>> 0);
    const provider = makeProvider(rng, volatilityFallback);
    const { result } = runProjection(scenario, settings, provider);

    result.rows.forEach((row, j) => {
      if (j < years) {
        yearBalances[j].push(row.endingBalance);
        if (p === 0) cpiByYear[j] = row.cpiFactor;
      }
    });

    endingToday.push(result.endingBalanceToday);

    const failed = result.depletionAge !== null;
    if (criterion === 'survival') {
      if (!failed) successCount++;
    } else {
      // meetSpending: treat depletion as failure (proxy)
      if (!failed) successCount++;
    }
    if (failed && result.depletionAge !== null) {
      const age = Math.round(result.depletionAge);
      failureAgeCounts.set(age, (failureAgeCounts.get(age) ?? 0) + 1);
    }

    if (onProgress && (p % progressEvery === 0 || p === paths - 1)) onProgress(p + 1, paths);
  }

  // Percentile bands (nominal) per year
  const percentileSeries: PercentilePoint[] = yearBalances.map((arr, j) => {
    const sorted = [...arr].sort((x, y) => x - y);
    return {
      age: Math.round(a.currentAge + j),
      cpi: cpiByYear[j] ?? 1,
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
    };
  });

  // Ending percentiles (today's dollars)
  const endSorted = [...endingToday].sort((x, y) => x - y);
  const mean = endingToday.reduce((s, v) => s + v, 0) / Math.max(1, endingToday.length);
  const endingPercentiles: EndingPercentiles = {
    p10: percentile(endSorted, 0.1),
    p25: percentile(endSorted, 0.25),
    p50: percentile(endSorted, 0.5),
    p75: percentile(endSorted, 0.75),
    p90: percentile(endSorted, 0.9),
    mean,
  };

  // Failure-age histogram
  const failureAges = [...failureAgeCounts.keys()].sort((x, y) => x - y);
  const failureAgeHistogram: FailureAgeBin[] = failureAges.map((age) => ({
    age,
    count: failureAgeCounts.get(age) ?? 0,
    pct: (failureAgeCounts.get(age) ?? 0) / Math.max(1, paths),
  }));
  const failureCount = paths - successCount;
  const earliestFailureAge = failureAges.length ? failureAges[0] : null;
  const medianFailureAge = medianOfHistogram(failureAgeHistogram, failureCount);

  // Ending-balance histogram (today's dollars), 0..P99 with overflow
  const endingHistogram = buildHistogram(endSorted);

  return {
    paths,
    criterion,
    configHash: String(seed),
    successProbability: successCount / Math.max(1, paths),
    successCount,
    failureCount,
    endingPercentiles,
    percentileSeries,
    failureAgeHistogram,
    earliestFailureAge,
    medianFailureAge,
    endingHistogram,
  };
}

function medianOfHistogram(bins: FailureAgeBin[], total: number): number | null {
  if (total === 0 || bins.length === 0) return null;
  let cum = 0;
  const half = total / 2;
  for (const b of bins) {
    cum += b.count;
    if (cum >= half) return b.age;
  }
  return bins[bins.length - 1].age;
}

function buildHistogram(sorted: number[]): EndingHistogramBin[] {
  if (sorted.length === 0) return [];
  const p99 = percentile(sorted, 0.99);
  const max = Math.max(p99, 1);
  const binCount = 24;
  const width = max / binCount;
  const bins: EndingHistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const start = i * width;
    const end = (i + 1) * width;
    bins.push({ binStart: start, binEnd: end, count: 0, label: fmtUSDAbbrev(start) });
  }
  const overflow: EndingHistogramBin = { binStart: max, binEnd: Infinity, count: 0, label: `>${fmtUSDAbbrev(max)}` };
  for (const v of sorted) {
    if (v > max) {
      overflow.count++;
      continue;
    }
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor(v / width)));
    bins[idx].count++;
  }
  if (overflow.count > 0) bins.push(overflow);
  return bins;
}
