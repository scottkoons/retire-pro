import { useMemo } from 'react';
import { runProjection, type ProjectionBundle } from '@/engine/project';
import type { Scenario, Settings } from '@/domain/types';
import { useActiveScenario, useStore } from '@/state/store';

// One projection per (scenario, settings) pair, shared by every caller.
//
// Before this, each screen ran its own projection AND the always-mounted
// Export PDF button ran another, so every edit computed the same 480-month
// projection at least twice (more on Compare). Immer gives an unchanged
// scenario a stable identity and a changed one a new identity, so keying on
// the object itself is both exact and free: a WeakMap entry is reused until
// that scenario is edited, then garbage-collected with it.
const cache = new WeakMap<Scenario, { settings: Settings; bundle: ProjectionBundle }>();

export function projectCached(scn: Scenario, settings: Settings): ProjectionBundle {
  const hit = cache.get(scn);
  if (hit && hit.settings === settings) return hit.bundle;
  const bundle = runProjection(scn, settings);
  cache.set(scn, { settings, bundle });
  return bundle;
}

/** Deterministic projection of the active scenario (shared across components). */
export function useProjection(): ProjectionBundle {
  const scn = useActiveScenario();
  const settings = useStore((s) => s.settings);
  return useMemo(() => projectCached(scn, settings), [scn, settings]);
}
