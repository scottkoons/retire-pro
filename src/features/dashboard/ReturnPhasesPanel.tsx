import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { Slider } from '@/components/ui/tiles';
import { NumField } from '@/components/ui/primitives';
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

  // Compact: header and tiles sized to match the ControlTile row above it.
  return (
    <div className="rounded-xl border border-border-subtle bg-card px-4 pb-4 pt-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">
            <IconTrendingUp className="h-4 w-4" />
          </span>
          <span className="label-mono">Average Return by Phase</span>
        </div>
        <button
          type="button"
          onClick={addReturnPhase}
          title="Split the timeline into age ranges with different expected returns — drives the projection and Monte Carlo"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint"
        >
          <IconPlus className="h-3.5 w-3.5" /> Add phase
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {phases.length > 0 ? (
          phases.map((p) => (
            <div
              key={p.id}
              className={clsx('rounded-lg border border-border-subtle bg-card-high px-3 pb-3 pt-2', !p.enabled && 'opacity-50')}
            >
              <div className="mb-1 flex items-center gap-1">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateReturnPhase(p.id, { name: e.target.value })}
                  placeholder="Phase name"
                  aria-label="Phase name"
                  className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[12px] font-semibold text-ink transition-colors hover:border-border-strong focus:border-primary focus:bg-input focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeReturnPhase(p.id)}
                  aria-label="Delete phase"
                  className="shrink-0 rounded p-0.5 text-faint transition-colors hover:text-error"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-14 shrink-0 font-head text-[22px] font-bold leading-none text-ink tabnum">
                  {+(p.expectedReturn * 100).toFixed(1)}
                  <span className="ml-0.5 text-[13px] font-semibold text-muted">%</span>
                </span>
                <Slider min={0} max={0.12} step={0.001} value={p.expectedReturn} onChange={(v) => updateReturnPhase(p.id, { expectedReturn: v })} aria-label="Expected return" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <span className="uppercase tracking-[0.06em] text-faint">Ages</span>
                <NumField value={Math.round(p.startAge)} onCommit={(n) => updateReturnPhase(p.id, { startAge: n })} className={ageInputCls} ariaLabel="Start age" />
                <span className="text-faint">–</span>
                <NumField value={Math.round(p.endAge)} onCommit={(n) => updateReturnPhase(p.id, { endAge: n })} className={ageInputCls} ariaLabel="End age" />
              </div>
            </div>
          ))
        ) : (
          // No phases yet: one compact row editing the global default (applies to every age).
          <div className="rounded-lg border border-border-subtle bg-card-high px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[12px] font-semibold text-ink">
                All ages <span className="font-normal text-faint">· default</span>
              </span>
              <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
                <span className="w-14 shrink-0 font-head text-[22px] font-bold leading-none text-ink tabnum">
                  {+(a.annualReturn * 100).toFixed(1)}
                  <span className="ml-0.5 text-[13px] font-semibold text-muted">%</span>
                </span>
                <Slider min={0} max={0.12} step={0.001} value={a.annualReturn} onChange={(v) => setAssumption('annualReturn', v)} aria-label="Default return" />
              </div>
              <span className="text-[11px] text-faint">
                Ages {Math.round(a.currentAge)} – {Math.round(a.modelEndAge)} · Add phase to split by age
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
