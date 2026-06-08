import { useMemo } from 'react';
import { useActiveScenario, useEffectiveDisplayMode, useStore } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { useMcStore } from '@/state/mcStore';
import { buildPlanSummaryModel } from '@/selectors/planSummary';
import { Section, StatusPill } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/tiles';
import { WealthChart } from '@/components/charts/WealthChart';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { useSort, type SortState } from '@/components/grid/Grid';
import { fmtUSD, fmtPct } from '@/lib/format';

function MiniTable({
  head,
  rows,
  sortKeys,
  sort,
  onSort,
}: {
  head: string[];
  rows: (string | number)[][];
  // Per-column sort keys, aligned with `head`. A null/undefined entry means that column is not sortable.
  sortKeys?: (string | undefined)[];
  sort?: SortState;
  onSort?: (key: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="bg-card-high">
          {head.map((h, i) => {
            const sortKey = sortKeys?.[i];
            const sortable = !!sortKey && !!onSort;
            const active = !!sort && sortKey === sort.key;
            const alignCls = i === 0 ? 'text-left' : 'text-right';
            return (
              <th
                key={h}
                className={`border-b border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-wide ${active ? 'text-ink' : 'text-muted'} ${alignCls}`}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort!(sortKey!)}
                    className={`group inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink ${i === 0 ? '' : 'flex-row-reverse'}`}
                    title={`Sort by ${h}`}
                  >
                    <span>{h}</span>
                    <span className={`text-[9px] leading-none ${active ? 'text-primary' : 'text-faint opacity-0 group-hover:opacity-100'}`}>
                      {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '▲'}
                    </span>
                  </button>
                ) : (
                  h
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-border-subtle">
            {r.map((c, ci) => (
              <td key={ci} className={`px-3 py-1.5 ${ci === 0 ? 'text-left text-ink' : 'text-right font-mono tabnum text-muted'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SummaryPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const household = useStore((s) => s.settings.household);
  const mc = useMcStore((s) => s.result);

  const model = useMemo(() => buildPlanSummaryModel(scn, result, mc, displayMode, household), [scn, result, mc, displayMode, household]);

  const k = model.keyResults;

  // Income Streams table: default sort by Start age ascending.
  const incomeSort = useSort(
    model.incomeStreams,
    {
      name: (s) => s.name.toLowerCase(),
      today: (s) => s.today,
      start: (s) => s.start,
      end: (s) => s.end,
      cola: (s) => s.cola,
      atRetire: (s) => s.atRetire,
    },
    { key: 'start', dir: 'asc' },
  );

  // Lump Sum Events table: default sort by Age ascending.
  const lumpSort = useSort(
    model.lumpSums,
    {
      name: (l) => l.name.toLowerCase(),
      age: (l) => l.age,
      amount: (l) => l.amount,
    },
    { key: 'age', dir: 'asc' },
  );

  // Spending Phases table: default sort by Start age ascending.
  const phaseSort = useSort(
    model.spendingPhases,
    {
      name: (p) => p.name.toLowerCase(),
      start: (p) => p.start,
      end: (p) => p.end,
      target: (p) => p.target,
    },
    { key: 'start', dir: 'asc' },
  );

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-head text-head-lg text-ink">Plan Summary</h1>
          <p className="mt-1 text-[13px] text-muted">{model.household} · {model.scenarioName} · generated {model.generatedOn}</p>
        </div>
        <ExportPdfButton variant="primary" size="md" />
      </div>

      <Section title="Key Projected Results">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Balance at Retirement" value={fmtUSD(k.balanceAtRetirement)} />
          <StatTile label="Monthly Income" value={fmtUSD(k.monthlyIncome)} sub={`at age ${Math.round(model.assumptions.retireAge)}`} />
          <StatTile label="Annual Income" value={fmtUSD(k.annualIncome)} />
          <StatTile label="Guaranteed / mo" value={fmtUSD(k.guaranteedMonthly)} />
          <StatTile label="Portfolio Draw / mo" value={fmtUSD(k.requiredWithdrawal)} />
          <StatTile label="Status" value={<StatusPill status={k.status} />} />
        </div>
      </Section>

      <Section title="Assumptions">
        <MiniTable
          head={['Parameter', 'Value']}
          rows={[
            ['Current age', model.assumptions.currentAge],
            ['Retirement age', model.assumptions.retireAge],
            ['Model end age', model.assumptions.modelEndAge],
            ['Annual return', fmtPct(model.assumptions.annualReturn)],
            ['Inflation', fmtPct(model.assumptions.inflation)],
            ['Starting balance', fmtUSD(model.assumptions.startingBalance)],
            ['Withdrawal', model.assumptions.withdrawal],
          ]}
        />
      </Section>

      <Section title="Projected Wealth Growth">
        <WealthChart rows={result.rows} markers={result.markers} retireAge={Math.round(model.assumptions.retireAge)} displayMode={displayMode} range="MAX" currentAge={Math.round(model.assumptions.currentAge)} height={260} />
      </Section>

      <Section title="Income Streams">
        <MiniTable
          head={['Source', "Today $/mo", 'Start', 'End', 'COLA', `@ ${Math.round(model.assumptions.retireAge)}`]}
          sortKeys={['name', 'today', 'start', 'end', 'cola', 'atRetire']}
          sort={incomeSort.sort}
          onSort={incomeSort.onSort}
          rows={incomeSort.sorted.map((s) => [s.name, fmtUSD(s.today), s.start, s.end, fmtPct(s.cola), fmtUSD(s.atRetire)])}
        />
      </Section>

      <Section title="Lump Sum Events">
        <MiniTable
          head={['Event', 'Age', 'Amount']}
          sortKeys={['name', 'age', 'amount']}
          sort={lumpSort.sort}
          onSort={lumpSort.onSort}
          rows={lumpSort.sorted.map((l) => [l.name, l.age, fmtUSD(l.amount)])}
        />
      </Section>

      <Section title="Spending Phases">
        <MiniTable
          head={['Phase', 'Start', 'End', 'Target $/mo']}
          sortKeys={['name', 'start', 'end', 'target']}
          sort={phaseSort.sort}
          onSort={phaseSort.onSort}
          rows={phaseSort.sorted.map((p) => [p.name, p.start, p.end, fmtUSD(p.target)])}
        />
      </Section>

      <Section title="Monte Carlo Results">
        {model.monteCarlo.ran ? (
          <MiniTable
            head={['Metric', 'Value']}
            rows={[
              ['Simulations', model.monteCarlo.paths.toLocaleString()],
              ['Success probability', fmtPct(model.monteCarlo.success, 0)],
              ['Ending P10 (today $)', fmtUSD(model.monteCarlo.p10)],
              ['Ending P50 (today $)', fmtUSD(model.monteCarlo.p50)],
              ['Ending P90 (today $)', fmtUSD(model.monteCarlo.p90)],
              ['Median failure age', model.monteCarlo.medianFailureAge ?? 'none'],
            ]}
          />
        ) : (
          <p className="text-muted">Monte Carlo not run yet. Open the Monte Carlo page and run a simulation.</p>
        )}
      </Section>
    </div>
  );
}
