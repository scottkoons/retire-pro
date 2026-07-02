import { useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActiveScenario, useStore } from '@/state/store';
import { useMcStore, mcConfigHash } from '@/state/mcStore';
import { statusFromSuccess } from '@/engine/project';
import { Section, Button, StatusPill } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/tiles';
import { IconDice } from '@/components/icons';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev, fmtPct, fmtAgeYM } from '@/lib/format';

export default function MonteCarloPage() {
  const scn = useActiveScenario();
  const settings = useStore((s) => s.settings);
  const mc = useMcStore();
  const hash = mcConfigHash(scn, settings, 'survival');
  const fresh = mc.result && mc.configHash === hash;

  // Auto-run once if there is no cached result at all.
  useEffect(() => {
    if (!mc.result && !mc.running) mc.run(scn, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = mc.result;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-head text-head-lg text-ink">Monte Carlo</h1>
          <p className="mt-1 text-[13px] text-muted">
            {settings.monteCarlo.simulations.toLocaleString()} simulations · lognormal annual returns · seeded &amp; reproducible
          </p>
        </div>
        <Button onClick={() => mc.run(scn, settings)} disabled={mc.running}>
          <IconDice className="h-4 w-4" /> {mc.running ? `Running ${Math.round(mc.progress * 100)}%` : 'Run Monte Carlo'}
        </Button>
      </div>

      {!r && (
        <Section title="No results yet">
          <p className="text-muted">Run the simulation to see success probability and outcome distributions.</p>
        </Section>
      )}

      {r && (
        <>
          {!fresh && (
            <div className="rounded-lg border border-caution/40 bg-caution-tint px-4 py-2 text-[13px] text-caution">
              Inputs changed since this run. Re-run Monte Carlo to refresh.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile
              label="Success Probability"
              value={fmtPct(r.successProbability, 0)}
              sub={<StatusPill status={statusFromSuccess(r.successProbability)} />}
              accent={statusFromSuccess(r.successProbability) === 'onTrack' ? 'success' : statusFromSuccess(r.successProbability) === 'caution' ? 'caution' : 'error'}
            />
            <StatTile label="Median Ending (P50)" value={fmtUSD(r.endingPercentiles.p50)} sub="today's $" />
            <StatTile label="Failures" value={`${r.failureCount} / ${r.paths}`} sub={r.medianFailureAge ? `median at ${fmtAgeYM(r.medianFailureAge)}` : 'none'} />
            <StatTile label="Earliest Failure" value={r.earliestFailureAge ? fmtAgeYM(r.earliestFailureAge) : '—'} />
          </div>

          <Section title="Ending Balance Percentiles" subtitle="Portfolio value at end of plan, today's dollars">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['p10', 'p25', 'p50', 'p75', 'p90'] as const).map((k) => (
                <div key={k} className="rounded-lg border border-border-subtle bg-card-high p-4 text-center">
                  <div className="label-mono">{k.toUpperCase()}</div>
                  <div className="mt-1 font-head text-[20px] font-semibold text-ink tabnum">{fmtUSDAbbrev(r.endingPercentiles[k])}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Ending Balance Distribution" subtitle="Where the plan lands across all simulations (today's $)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={r.endingHistogram} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chart.axis} tickLine={false} tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: chart.axis }} interval={3} />
                <YAxis stroke={chart.axis} tickLine={false} axisLine={false} width={40} tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: chart.axis }} />
                <Tooltip
                  contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                  formatter={(v: number) => [`${v} runs`, 'Count']}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {r.endingHistogram.map((b, i) => (
                    <Cell key={i} fill={b.binStart === 0 ? chart.cat[6] : chart.primary} fillOpacity={b.binStart === 0 ? 1 : 0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {r.failureAgeHistogram.length > 0 && (
            <Section title="Failure Age Analysis" subtitle="When failing simulations deplete the portfolio">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={r.failureAgeHistogram} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="age" stroke={chart.axis} tickLine={false} tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: chart.axis }} tickFormatter={(a) => `Age ${a}`} />
                  <YAxis stroke={chart.axis} tickLine={false} axisLine={false} width={40} tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: chart.axis }} />
                  <Tooltip
                    contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                    formatter={(v: number) => [`${v} runs`, 'Failures']}
                    labelFormatter={(a) => `Age ${a}`}
                  />
                  <Bar dataKey="count" fill={chart.error} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
