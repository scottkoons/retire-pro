import { useMemo } from 'react';
import { runProjection, type ProjectionBundle } from '@/engine/project';
import { useActiveScenario } from '@/state/store';

/** Memoized deterministic projection of the active scenario. */
export function useProjection(): ProjectionBundle {
  const scn = useActiveScenario();
  return useMemo(() => runProjection(scn), [scn]);
}
