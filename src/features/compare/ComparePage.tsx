import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEffectiveDisplayMode, useStore } from '@/state/store';
import { runProjection } from '@/engine/project';
import { ageToMonthIndex, monthlyRate } from '@/engine/timeline';
import { Section, Button, Segmented, StatusPill } from '@/components/ui/primitives';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev, fmtAgeYM } from '@/lib/format';
import type { ProjectionResult, Scenario } from '@/domain/types';

// Stable per-scenario line colors (cycled from the categorical palette).
const COLORS = [chart.primary, chart.cat[5], chart.cat[3], chart.cat[1], chart.cat[2], chart.cat[4]];

interface Row {
  scn: Scenario;
  result: ProjectionResult;
  color: string;
}

function CompareTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-ink tabnum">{fmtUSDAbbrev(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ComparePage() {
  const navigate = useNavigate();
  const scenarios = useStore((s) => s.scenarios);
  const activeId = useStore((s) => s.activeScenarioId);
  const settings = useStore((s) => s.settings);
  const selectScenario = useStore((s) => s.selectScenario);
  const displayMode = useEffectiveDisplayMode();
  const setOverride = useStore((s) => s.setDisplayModeOverride);

  // Deterministic projection per scenario (cheap; Monte Carlo stays on its own page).
  const rows = useMemo<Row[]>(
    () =>
      scenarios.map((scn, i) => ({
        scn,
        result: runProjection(scn, settings).result,
        color: COLORS[i % COLORS.length],
      })),
    [scenarios, settings],
  );

  // Merge every scenario's yearly balances into one age-keyed series for the chart.
  const series = useMemo(() => {
    const byAge = new Map<number, Record<string, number>>();
    for (const r of rows) {
      for (const y of r.result.rows) {
        const v = displayMode === 'today' ? y.endingBalanceToday : y.endingBalance;
        const rec = byAge.get(y.age) ?? { age: y.age };
        rec[r.scn.id] = v;
        byAge.set(y.age, rec);
      }
    }
    return [...byAge.values()].sort((x, y) => x.age - y.age);
  }, [rows, displayMode]);

  const active = rows.find((r) => r.scn.id === activeId);
  const retireAge = active ? Math.round(active.scn.assumptions.retirementAge) : undefined;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-head-lg text-ink">Compare Scenarios</h1>
          <p className="mt-1 text-[13px] text-muted">Every saved scenario projected side by side. Monte Carlo detail lives on its own page.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-mono">Show amounts in</span>
          <Segmented
            size="sm"
            options={[
              { value: 'actual', label: 'Actual $' },
              { value: 'today', label: "Today's $" },
            ]}
            value={displayMode}
            onChange={(v) => setOverride(v)}
          />
        </div>
      </div>

      {rows.length < 2 && (
        <div className="rounded-lg border border-border-subtle bg-card px-4 py-3 text-[13px] text-muted">
          Only one scenario exists, so there is nothing to compare yet. Use the New Scenario button up top
          (or Settings → Scenarios) to duplicate this plan and change one assumption — the curves and numbers
          will appear here side by side.
        </div>
      )}

      <Section title="Wealth Curves" subtitle="Projected portfolio balance by age, one line per scenario">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={series} margin={{ top: 20, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis
              dataKey="age"
              stroke={chart.axis}
              tickLine={false}
              tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }}
              tickFormatter={(a: number) => `Age ${a}`}
            />
            <YAxis
              stroke={chart.axis}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }}
              tickFormatter={(v: number) => fmtUSDAbbrev(v)}
            />
            <Tooltip content={<CompareTooltip />} />
            {retireAge != null && (
              <ReferenceLine
                x={retireAge}
                stroke={chart.axis}
                strokeDasharray="3 3"
                label={{ value: 'Retirement', fill: chart.axis, fontFamily: 'Inter Variable', fontSize: 11, position: 'top' }}
              />
            )}
            {rows.map((r) => (
              <Line
                key={r.scn.id}
                type="monotone"
                dataKey={r.scn.id}
                name={r.scn.name}
                stroke={r.color}
                strokeWidth={r.scn.id === activeId ? 2.5 : 1.6}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted">
          {rows.map((r) => (
            <span key={r.scn.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: r.color }} />
              {r.scn.name}
              {r.scn.id === activeId && <span className="text-[10px] uppercase tracking-wide text-primary">active</span>}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Key Numbers" subtitle="Deterministic projection per scenario" bodyClassName="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                {['Scenario', 'Balance at Retirement', 'Monthly Income', 'End of Horizon', 'Depletes', 'Status', ''].map((h, i) => (
                  <th
                    key={h || 'open'}
                    className={`sticky top-0 border-b border-border-strong bg-card-high px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted ${i === 0 || i > 4 ? 'text-left' : 'text-right'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const res = r.result;
                const a = r.scn.assumptions;
                const cpiRet = Math.pow(1 + monthlyRate(a.inflation), ageToMonthIndex(a.retirementAge, a.currentAge));
                const balRet = displayMode === 'today' ? res.projectedBalanceAtRetirementToday : res.projectedBalanceAtRetirement;
                const monthly = displayMode === 'today' ? res.monthlyIncomeAtRetirement / cpiRet : res.monthlyIncomeAtRetirement;
                const ending = displayMode === 'today' ? res.endingBalanceToday : res.endingBalance;
                const isActive = r.scn.id === activeId;
                return (
                  <tr key={r.scn.id} className={`border-b border-border-subtle hover:bg-hover ${isActive ? 'bg-primary-tint' : ''}`}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        {r.scn.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink tabnum">{fmtUSD(balRet)}</td>
                    <td className="px-4 py-2.5 text-right text-ink tabnum">{fmtUSD(monthly)}</td>
                    <td className="px-4 py-2.5 text-right text-ink tabnum">{fmtUSD(ending)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{res.depletionAge != null ? fmtAgeYM(res.depletionAge) : 'never'}</td>
                    <td className="px-4 py-2.5"><StatusPill status={res.status} /></td>
                    <td className="px-4 py-2.5 text-right">
                      {!isActive && (
                        <Button variant="ghost" size="sm" onClick={() => { selectScenario(r.scn.id); navigate('/'); }}>
                          Open
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
