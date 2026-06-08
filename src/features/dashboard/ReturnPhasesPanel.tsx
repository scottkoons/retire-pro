import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { IconPlus, IconTrash, IconTrendingUp } from '@/components/icons';

// Compact inline editor styling, sized for the dashboard (not the grid table).
const numCls =
  'rounded-sm border border-border-strong bg-input px-2 py-1 font-mono text-[13px] text-ink tabnum text-right transition-colors hover:border-primary/60 focus:border-primary focus:outline-none';
const nameCls =
  'min-w-0 flex-1 rounded-sm border border-border-strong bg-input px-2 py-1 text-[13px] text-ink transition-colors hover:border-primary/60 focus:border-primary focus:outline-none';

/** Dashboard panel that replaces the single "Average Return" slider with a
 *  per-phase return editor. It reads and writes the SAME scn.investmentReturnPhases
 *  that the Phases page edits, so changes here flow straight into the projection
 *  (and Monte Carlo) and stay in sync across both screens. The global annualReturn
 *  is shown as the editable fallback used for any age no phase covers. */
export function ReturnPhasesPanel() {
  const scn = useActiveScenario();
  const addReturnPhase = useStore((s) => s.addReturnPhase);
  const updateReturnPhase = useStore((s) => s.updateReturnPhase);
  const removeReturnPhase = useStore((s) => s.removeReturnPhase);
  const setAssumption = useStore((s) => s.setAssumption);

  // Sorted copy for display; edits still target the stable phase id.
  const phases = [...scn.investmentReturnPhases].sort((x, y) => x.startAge - y.startAge);
  const globalPct = +(scn.assumptions.annualReturn * 100).toFixed(1);

  return (
    <div className="rounded-xl border border-border-subtle bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">
            <IconTrendingUp className="h-5 w-5" />
          </span>
          <span className="label-mono">Average Return by Phase</span>
        </div>
        <button
          type="button"
          onClick={addReturnPhase}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-input px-2.5 py-1.5 text-[12px] font-medium text-primary transition-colors hover:border-primary"
        >
          <IconPlus className="h-4 w-4" /> Add phase
        </button>
      </div>
      <p className="mb-4 text-[12px] text-muted">Set an expected return per age range — drives the projection and Monte Carlo.</p>

      {phases.length === 0 ? (
        <p className="mb-4 rounded-md border border-dashed border-border-strong px-3 py-3 text-[13px] text-muted">
          No phases yet — the default return below applies to every age. Add a phase to vary the return across retirement.
        </p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
            <span className="flex-1">Phase</span>
            <span className="w-36 text-center">Ages</span>
            <span className="w-20 text-right">Return</span>
            <span className="w-7" />
          </div>
          {phases.map((p) => (
            <div key={p.id} className={clsx('flex items-center gap-2', !p.enabled && 'opacity-50')}>
              <input
                type="text"
                value={p.name}
                onChange={(e) => updateReturnPhase(p.id, { name: e.target.value })}
                className={nameCls}
                aria-label="Phase name"
              />
              <div className="flex w-36 items-center justify-center gap-1 text-faint">
                <input
                  type="number"
                  value={Math.round(p.startAge)}
                  onChange={(e) => updateReturnPhase(p.id, { startAge: Number(e.target.value) })}
                  className={clsx(numCls, 'w-14')}
                  aria-label="Start age"
                />
                <span>–</span>
                <input
                  type="number"
                  value={Math.round(p.endAge)}
                  onChange={(e) => updateReturnPhase(p.id, { endAge: Number(e.target.value) })}
                  className={clsx(numCls, 'w-14')}
                  aria-label="End age"
                />
              </div>
              <div className="flex w-20 items-center justify-end gap-0.5">
                <input
                  type="number"
                  step={0.1}
                  value={+(p.expectedReturn * 100).toFixed(1)}
                  onChange={(e) => updateReturnPhase(p.id, { expectedReturn: Number(e.target.value) / 100 })}
                  className={clsx(numCls, 'w-14')}
                  aria-label="Expected return"
                />
                <span className="text-faint">%</span>
              </div>
              <button
                type="button"
                onClick={() => removeReturnPhase(p.id)}
                aria-label="Delete phase"
                className="flex w-7 justify-end rounded p-1 text-faint transition-colors hover:text-error"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global fallback return — always editable, used for ages no phase covers. */}
      <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
        <span className="flex-1 text-[13px] text-muted">
          {phases.length ? 'Default — ages no phase covers' : 'Default return — all ages'}
        </span>
        <div className="flex w-20 items-center justify-end gap-0.5">
          <input
            type="number"
            step={0.1}
            value={globalPct}
            onChange={(e) => setAssumption('annualReturn', Number(e.target.value) / 100)}
            className={clsx(numCls, 'w-14')}
            aria-label="Default return"
          />
          <span className="text-faint">%</span>
        </div>
        <span className="w-7" />
      </div>
    </div>
  );
}
