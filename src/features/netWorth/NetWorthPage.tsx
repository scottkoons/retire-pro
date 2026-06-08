import { useMemo } from 'react';
import { useActiveScenario, useEffectiveDisplayMode } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { Section } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/tiles';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { fmtUSD } from '@/lib/format';

export default function NetWorthPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const rows = result.rows;
  const a = scn.assumptions;

  const hasNetWorth = rows.some((r) => r.netWorth != null);

  const stats = useMemo(() => {
    const val = (r: (typeof rows)[number]) => (displayMode === 'today' ? r.netWorthToday ?? 0 : r.netWorth ?? 0);
    const peak = rows.reduce((m, r) => Math.max(m, val(r)), 0);
    const peakRow = rows.find((r) => val(r) === peak);
    const atRet = rows.find((r) => r.age >= Math.round(a.retirementAge));
    const last = rows[rows.length - 1];
    const peakEquity = rows.reduce((m, r) => Math.max(m, displayMode === 'today' ? (r.homeEquity ?? 0) / r.cpiFactor : r.homeEquity ?? 0), 0);
    return {
      peak,
      peakAge: peakRow?.age,
      atRet: atRet ? val(atRet) : 0,
      ending: last ? val(last) : 0,
      peakEquity,
    };
  }, [rows, displayMode, a.retirementAge]);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Net Worth</h1>
        <p className="mt-1 text-[13px] text-muted">
          Account balances and home equity over time.
          <span className="ml-2 rounded bg-input px-2 py-0.5 font-mono text-[11px] text-muted">{displayMode === 'today' ? "today's $" : 'actual $'}</span>
        </p>
      </div>

      {!hasNetWorth ? (
        <Section title="Net worth modeling is off">
          <p className="text-[14px] text-muted">
            This scenario is using the simple single-balance projection. Add accounts, a home, or healthcare on the Planner Sheet to unlock the tax-aware net-worth model.
          </p>
        </Section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Peak Net Worth" value={fmtUSD(stats.peak)} sub={stats.peakAge ? `at age ${stats.peakAge}` : undefined} tint="green" />
            <StatTile label={`At Retirement (${Math.round(a.retirementAge)})`} value={fmtUSD(stats.atRet)} tint="blue" />
            <StatTile label={`Ending (${Math.round(a.modelEndAge)})`} value={fmtUSD(stats.ending)} tint="violet" />
            <StatTile label="Peak Home Equity" value={fmtUSD(stats.peakEquity)} tint="amber" />
          </div>

          <Section title="Net Worth Composition" subtitle="Taxable, pre-tax, Roth, and home equity stacked; line is total net worth">
            <NetWorthChart rows={rows} displayMode={displayMode} height={420} />
          </Section>
        </>
      )}
    </div>
  );
}
