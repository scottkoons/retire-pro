import { useActiveScenario, useEffectiveDisplayMode } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { Section } from '@/components/ui/primitives';
import { fmtUSD, fmtPct } from '@/lib/format';
import { useSort } from '@/components/grid/Grid';

export default function YearByYearPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const retireAge = Math.round(scn.assumptions.retirementAge);

  // label + sortKey per column; sortKey matches the accessor key below and the data column order.
  const cols: { label: string; sortKey: string }[] = [
    { label: 'Age', sortKey: 'age' },
    { label: 'Year', sortKey: 'year' },
    { label: 'Starting', sortKey: 'startingBalance' },
    { label: 'Contributions', sortKey: 'contributions' },
    { label: 'Lump sums', sortKey: 'lumpSums' },
    { label: 'Return', sortKey: 'returnRate' },
    { label: 'Growth', sortKey: 'investmentGrowth' },
    { label: 'Guaranteed', sortKey: 'guaranteedIncome' },
    { label: 'Withdrawals', sortKey: 'withdrawals' },
    { label: 'Est. Tax', sortKey: 'totalTax' },
    { label: 'Ending', sortKey: 'endingBalance' },
    { label: "Today's $", sortKey: 'endingBalanceToday' },
    { label: 'Actual $', sortKey: 'endingBalanceActual' },
  ];

  // Every column is numeric, so each accessor returns a number.
  const { sorted, sort, onSort } = useSort(
    result.rows,
    {
      age: (r) => r.age,
      year: (r) => r.year,
      startingBalance: (r) => r.startingBalance,
      contributions: (r) => r.contributions,
      lumpSums: (r) => r.lumpSums,
      returnRate: (r) => r.returnRate,
      investmentGrowth: (r) => r.investmentGrowth,
      guaranteedIncome: (r) => r.guaranteedIncome,
      withdrawals: (r) => r.withdrawals,
      // Undefined before retirement; useSort keeps blanks at the bottom.
      totalTax: (r) => r.totalTax,
      endingBalance: (r) => r.endingBalance,
      endingBalanceToday: (r) => r.endingBalanceToday,
      endingBalanceActual: (r) => r.endingBalance,
    },
    { key: 'age', dir: 'asc' },
  );

  const cell = (n: number) => <span className="font-mono tabnum text-ink">{fmtUSD(n)}</span>;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Year-by-Year</h1>
        <p className="mt-1 text-[13px] text-muted">
          Full projection, {result.rows.length} model years. Est. Tax is federal plus Colorado income tax on retirement
          income (married filing jointly, actual dollars); hover a value for the split.{' '}
          <span className="ml-1 rounded bg-input px-2 py-0.5 font-mono text-[11px] text-muted">{displayMode === 'today' ? "today's $" : 'actual $'}</span>
        </p>
      </div>

      <Section title="Projection Detail" bodyClassName="px-0 pb-0">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-card-high">
                {cols.map((c, i) => {
                  const left = i < 2;
                  const active = sort.key === c.sortKey;
                  return (
                    <th
                      key={c.sortKey}
                      className={`border-b border-border-strong px-2 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.05em] ${
                        active ? 'text-ink' : 'text-muted'
                      } ${left ? 'text-left' : 'text-right'}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey)}
                        className="group relative inline-flex items-center uppercase tracking-[0.05em] transition-colors hover:text-ink"
                        title={`Sort by ${c.label}`}
                      >
                        <span>{c.label}</span>
                        {/* The arrow sits in the cell padding so it takes no column width:
                            reserving room for it in all 13 columns pushed the table wider
                            than the screen. */}
                        <span
                          className={`absolute top-1/2 -translate-y-1/2 text-[9px] leading-none ${left ? '-right-2' : '-left-2'} ${
                            active ? 'text-primary' : 'text-faint opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isRetire = r.age === retireAge;
                return (
                  <tr key={r.age} className={`border-b border-border-subtle hover:bg-hover ${isRetire ? 'bg-primary-tint' : ''}`}>
                    <td className="px-2 py-1.5 font-mono text-ink tabnum">
                      {r.age}
                      {isRetire && <span className="ml-1.5 rounded bg-primary px-1 py-px text-[9px] text-primary-on">RET</span>}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-muted tabnum">{r.year}</td>
                    <td className="px-2 py-1.5 text-right">{cell(r.startingBalance)}</td>
                    <td className="px-2 py-1.5 text-right">{cell(r.contributions)}</td>
                    <td className="px-2 py-1.5 text-right">{r.lumpSums ? <span className="font-mono tabnum text-cat-4">{fmtUSD(r.lumpSums)}</span> : <span className="text-faint">—</span>}</td>
                    <td className="px-2 py-1.5 text-right"><span className="font-mono tabnum text-muted">{fmtPct(r.returnRate, 1)}</span></td>
                    <td className="px-2 py-1.5 text-right"><span className="font-mono tabnum text-success">{fmtUSD(r.investmentGrowth)}</span></td>
                    <td className="px-2 py-1.5 text-right">{cell(r.guaranteedIncome)}</td>
                    <td className="px-2 py-1.5 text-right">{r.withdrawals ? <span className="font-mono tabnum text-cat-1">{fmtUSD(r.withdrawals)}</span> : <span className="text-faint">—</span>}</td>
                    <td className="px-2 py-1.5 text-right">
                      {r.totalTax != null ? (
                        <span
                          className="font-mono tabnum text-tax"
                          title={`Federal ${fmtUSD((r.federalTax ?? 0) + (r.capGainsTax ?? 0) + (r.niit ?? 0))} + Colorado ${fmtUSD(r.stateTax ?? 0)} · ${fmtPct(r.effectiveRate ?? 0, 1)} of income`}
                        >
                          {fmtUSD(r.totalTax)}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">{cell(r.endingBalance)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabnum text-muted">{fmtUSD(r.endingBalanceToday)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabnum text-muted">{fmtUSD(r.endingBalance)}</td>
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
