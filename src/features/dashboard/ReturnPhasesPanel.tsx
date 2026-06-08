import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { Slider } from '@/components/ui/tiles';
import { IconPlus, IconTrash, IconTrendingUp } from '@/components/icons';

const ageInputCls =
  'w-10 rounded-sm border border-border-strong bg-input px-1 py-0.5 text-center font-mono text-[12px] text-ink tabnum transition-colors hover:border-primary/60 focus:border-primary focus:outline-none';

/** Dashboard panel: the average return as one tile per investment-return phase.
 *  Each tile carries an editable name, a big % with a slider, and its age range.
 *  Tiles fill the whole row and split evenly by count (1 = full width, 2 = halves,
 *  3 = thirds, 4 = quarters) via CSS grid auto-fit; "Add New" splits the latest
 *  phase in half. The tiles read/write the same scn.investmentReturnPhases the
 *  Phases page uses, so edits flow straight into the projection and Monte Carlo.
 *  With no phases, a single full-width tile edits the global default return. */
export function ReturnPhasesPanel() {
  const scn = useActiveScenario();
  const a = scn.assumptions;
  const addReturnPhase = useStore((s) => s.addReturnPhase);
  const updateReturnPhase = useStore((s) => s.updateReturnPhase);
  const removeReturnPhase = useStore((s) => s.removeReturnPhase);
  const setAssumption = useStore((s) => s.setAssumption);

  // Sorted copy for display; edits still target the stable phase id.
  const phases = [...scn.investmentReturnPhases].sort((x, y) => x.startAge - y.startAge);

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
          <IconPlus className="h-4 w-4" /> Add New
        </button>
      </div>
      <p className="mb-4 text-[12px] text-muted">
        Each tile is an age range and its expected return — add to split the timeline. Drives the projection and Monte Carlo.
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {phases.length > 0 ? (
          phases.map((p) => (
            <div
              key={p.id}
              className={clsx('rounded-xl border border-border-subtle bg-card-high p-4', !p.enabled && 'opacity-50')}
            >
              <div className="mb-3 flex items-start gap-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateReturnPhase(p.id, { name: e.target.value })}
                  placeholder="Phase name"
                  aria-label="Phase name"
                  className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-semibold text-ink transition-colors hover:border-border-strong focus:border-primary focus:bg-input focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeReturnPhase(p.id)}
                  aria-label="Delete phase"
                  className="shrink-0 rounded p-1 text-faint transition-colors hover:text-error"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-head text-[34px] font-bold leading-none text-ink tabnum">
                  {+(p.expectedReturn * 100).toFixed(1)}
                </span>
                <span className="font-mono text-[14px] text-muted">%</span>
              </div>
              <div className="mt-3">
                <Slider min={0} max={0.12} step={0.001} value={p.expectedReturn} onChange={(v) => updateReturnPhase(p.id, { expectedReturn: v })} aria-label="Expected return" />
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px]">
                <span className="font-mono uppercase tracking-[0.06em] text-faint">Ages</span>
                <input type="number" value={Math.round(p.startAge)} onChange={(e) => updateReturnPhase(p.id, { startAge: Number(e.target.value) })} className={ageInputCls} aria-label="Start age" />
                <span className="text-faint">–</span>
                <input type="number" value={Math.round(p.endAge)} onChange={(e) => updateReturnPhase(p.id, { endAge: Number(e.target.value) })} className={ageInputCls} aria-label="End age" />
              </div>
            </div>
          ))
        ) : (
          // No phases yet: one full-width tile editing the global default (applies to every age).
          <div className="rounded-xl border border-border-subtle bg-card-high p-4">
            <div className="mb-3 px-1 text-[13px] font-semibold text-ink">
              All ages <span className="ml-1 font-normal text-faint">· default</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-head text-[34px] font-bold leading-none text-ink tabnum">{+(a.annualReturn * 100).toFixed(1)}</span>
              <span className="font-mono text-[14px] text-muted">%</span>
            </div>
            <div className="mt-3">
              <Slider min={0} max={0.12} step={0.001} value={a.annualReturn} onChange={(v) => setAssumption('annualReturn', v)} aria-label="Default return" />
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px]">
              <span className="font-mono uppercase tracking-[0.06em] text-faint">Ages</span>
              <span className="font-mono tabnum text-muted">{Math.round(a.currentAge)} – {Math.round(a.modelEndAge)}</span>
              <span className="ml-1 text-faint">· Add New to split by age</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
