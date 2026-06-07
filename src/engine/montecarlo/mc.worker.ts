/// <reference lib="webworker" />
import { runMonteCarlo } from './simulate';
import type { MonteCarloRequest, WorkerOutbound } from './types';

self.onmessage = (e: MessageEvent<MonteCarloRequest>) => {
  const post = (msg: WorkerOutbound) => (self as DedicatedWorkerGlobalScope).postMessage(msg);
  try {
    const result = runMonteCarlo(e.data, (completed, total) => post({ type: 'progress', completed, total }));
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'Monte Carlo failed' });
  }
};
