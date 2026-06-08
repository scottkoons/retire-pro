import { useMemo } from 'react';
import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { useMcStore, mcConfigHash } from '@/state/mcStore';
import { Section } from '@/components/ui/primitives';
import { planCheckup, type Insight } from '@/selectors/checkup';

const SEV: Record<Insight['severity'], { bar: string; badge: string; label: string }> = {
  warning: { bar: 'bg-error', badge: 'bg-error-tint text-error', label: 'Warning' },
  caution: { bar: 'bg-caution', badge: 'bg-caution-tint text-caution', label: 'Caution' },
  info: { bar: 'bg-primary', badge: 'bg-primary-tint text-primary', label: 'Insight' },
};

export default function CheckupPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const settings = useStore((s) => s.settings);
  const mc = useMcStore();

  const mcFresh = mc.result && mc.configHash === mcConfigHash(scn, settings, 'survival');
  const mcSuccess = mcFresh ? mc.result?.successProbability : undefined;

  const insights = useMemo(
    () => planCheckup({ rows: result.rows, result, scn, settings, mcSuccess }),
    [result, scn, settings, mcSuccess],
  );

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Plan Checkup</h1>
        <p className="mt-1 text-[13px] text-muted">Automated insights and risk flags for {scn.name}.</p>
      </div>

      {insights.length === 0 ? (
        <Section title="No flags">
          <p className="text-[14px] text-muted">Nothing stands out right now. Run Monte Carlo and revisit after editing the plan.</p>
        </Section>
      ) : (
        <div className="flex flex-col gap-3">
          {insights.map((ins) => {
            const sev = SEV[ins.severity];
            return (
              <div key={ins.id} className="relative overflow-hidden rounded-xl border border-border-subtle bg-card p-5 pl-6">
                <span className={clsx('absolute inset-y-4 left-0 w-1 rounded-full', sev.bar)} />
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide', sev.badge)}>{sev.label}</span>
                  <h2 className="font-head text-[17px] font-semibold text-ink">{ins.title}</h2>
                </div>
                <p className="text-[14px] leading-relaxed text-muted">{ins.detail}</p>
              </div>
            );
          })}
        </div>
      )}

      {!mcFresh && (
        <p className="text-[12px] text-faint">Monte Carlo result is stale or not run; success-rate insight is omitted. Open the Dashboard or Monte Carlo page to refresh it.</p>
      )}
    </div>
  );
}
