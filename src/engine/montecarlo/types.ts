import type { Scenario, Settings } from '@/domain/types';

export type SuccessCriterion = 'survival' | 'meetSpending';

export interface MonteCarloRequest {
  scenario: Scenario;
  settings: Settings; // carried so the tax-aware v2 engine can run inside the worker
  paths: number;
  volatilityFallback: number;
  seed: number;
  criterion: SuccessCriterion;
}

export interface PercentilePoint {
  age: number;
  cpi: number; // deterministic deflator for this age (same across paths)
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface EndingPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface FailureAgeBin {
  age: number;
  count: number;
  pct: number;
}

export interface EndingHistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
  label: string;
}

export interface MonteCarloResult {
  paths: number;
  criterion: SuccessCriterion;
  configHash: string;
  successProbability: number;
  successCount: number;
  failureCount: number;
  endingPercentiles: EndingPercentiles; // today's dollars
  percentileSeries: PercentilePoint[]; // nominal; deflate with cpi for today's $
  failureAgeHistogram: FailureAgeBin[];
  earliestFailureAge: number | null;
  medianFailureAge: number | null;
  endingHistogram: EndingHistogramBin[]; // today's dollars
}

export type WorkerOutbound =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done'; result: MonteCarloResult }
  | { type: 'error'; message: string };
