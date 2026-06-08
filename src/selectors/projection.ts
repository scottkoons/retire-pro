import { useMemo } from 'react';
import { runProjection, type ProjectionBundle } from '@/engine/project';
import { useActiveScenario, useStore } from '@/state/store';

/** Memoized deterministic projection of the active scenario. */
export function useProjection(): ProjectionBundle {
  const scn = useActiveScenario();
  const settings = useStore((s) => s.settings);
  return useMemo(() => runProjection(scn, settings), [scn, settings]);
}
