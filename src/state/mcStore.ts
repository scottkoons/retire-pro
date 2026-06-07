import { create } from 'zustand';
import type { Scenario, Settings } from '@/domain/types';
import type { MonteCarloRequest, MonteCarloResult, WorkerOutbound, SuccessCriterion } from '@/engine/montecarlo/types';
import { hashString } from '@/engine/montecarlo/prng';
import { MC_CACHE_KEY } from '@/persistence/constants';

interface McState {
  result: MonteCarloResult | null;
  running: boolean;
  progress: number;
  error?: string;
  configHash: string | null;
  run: (scenario: Scenario, settings: Settings, criterion?: SuccessCriterion) => void;
  cancel: () => void;
  markStaleCheck: (hash: string) => void;
}

let worker: Worker | null = null;

// Bump when the projection/withdrawal math changes so cached MC results invalidate.
const ENGINE_VERSION = 4;

function mcConfigHash(scn: Scenario, settings: Settings, criterion: SuccessCriterion): string {
  return String(
    hashString(
      JSON.stringify({
        eng: ENGINE_VERSION,
        a: scn.assumptions,
        c: scn.contributions,
        l: scn.lumpSums,
        s: scn.incomeStreams,
        rp: scn.retirementPhases,
        irp: scn.investmentReturnPhases,
        w: scn.withdrawal,
        mc: scn.monteCarlo,
        // v2 inputs that affect the projection:
        acc: scn.accounts,
        exp: scn.expenses,
        home: scn.home,
        ss: scn.socialSecurity,
        hc: scn.healthcare,
        ltc: scn.longTermCare,
        inh: scn.inheritance,
        bv: scn.businessVenture,
        wseq: scn.withdrawalSequence,
        sm: scn.spendingMode,
        sim: settings.monteCarlo.simulations,
        vol: settings.monteCarlo.returnVolatility,
        rmdStart: settings.rmdStartAge,
        criterion,
      }),
    ),
  );
}

function loadCached(): MonteCarloResult | null {
  try {
    const t = localStorage.getItem(MC_CACHE_KEY);
    if (!t) return null;
    const r = JSON.parse(t) as Partial<MonteCarloResult> | null;
    // Validate the shape so a stale/corrupt blob from an older build cannot crash
    // pages that read result.endingPercentiles / result.percentileSeries on mount.
    if (
      r &&
      typeof r === 'object' &&
      typeof r.successProbability === 'number' &&
      r.endingPercentiles &&
      Array.isArray(r.percentileSeries) &&
      Array.isArray(r.endingHistogram)
    ) {
      return r as MonteCarloResult;
    }
    return null;
  } catch {
    return null;
  }
}

const cached = loadCached();

export const useMcStore = create<McState>((set, get) => ({
  result: cached,
  running: false,
  progress: 0,
  configHash: cached?.configHash ?? null,

  run: (scenario, settings, criterion = 'survival') => {
    const hash = mcConfigHash(scenario, settings, criterion);
    if (worker) worker.terminate();
    worker = new Worker(new URL('../engine/montecarlo/mc.worker.ts', import.meta.url), { type: 'module' });

    set({ running: true, progress: 0, error: undefined });

    const paths = Math.min(10000, Math.max(200, Math.round(settings.monteCarlo.simulations)));
    const req: MonteCarloRequest = {
      scenario,
      paths,
      volatilityFallback: settings.monteCarlo.returnVolatility,
      seed: Number(hash) >>> 0,
      criterion,
    };

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        set({ progress: msg.completed / msg.total });
      } else if (msg.type === 'done') {
        const result = { ...msg.result, configHash: hash };
        set({ result, running: false, progress: 1, configHash: hash });
        try {
          localStorage.setItem(MC_CACHE_KEY, JSON.stringify(result));
        } catch {
          /* ignore quota */
        }
        worker?.terminate();
        worker = null;
      } else {
        set({ running: false, error: msg.message });
        worker?.terminate();
        worker = null;
      }
    };

    worker.postMessage(req);
  },

  cancel: () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    set({ running: false });
  },

  markStaleCheck: (hash) => {
    // no-op hook for components to compute staleness via selector
    void hash;
  },
}));

export { mcConfigHash };
