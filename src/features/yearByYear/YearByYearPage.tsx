import { useActiveScenario, useEffectiveDisplayMode } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { Section } from '@/components/ui/primitives';
import { fmtUSD } from '@/lib/format';

export default function YearByYearPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const retireAge = Math.round(scn.assumptions.retirementAge);

  const cols = [
    'Age',
    'Year',
    'Starting',
    'Contributions',
    'Lump sums',
    'Growth',
    'Guaranteed',
    'Withdrawals',
    'Ending',
    "Today's $",
    'Actual $',
  ];

  const cell = (n: number) => <span className="font-mono tabnum text-ink">{fmtUSD(n)}</span>;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Year-by-Year</h1>
        <p className="mt-1 text-[13px] text-muted">
          Full projection, {result.rows.length} model years.{' '}
          <span className="ml-1 rounded bg-input px-2 py-0.5 font-mono text-[11px] text-muted">{displayMode === 'today' ? "today's $" : 'actual $'}</span>
        </p>
      </div>

      <Section title="Projection Detail" bodyClassName="px-0 pb-0">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-card-high">
                {cols.map((c, i) => (
                  <th
                    key={c}
                    className={`border-b border-border-strong px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-muted ${
                      i < 2 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const isRetire = r.age === retireAge;
                return (
                  <tr key={r.age} className={`border-b border-border-subtle hover:bg-hover ${isRetire ? 'bg-primary-tint' : ''}`}>
                    <td className="px-3 py-1.5 font-mono text-ink tabnum">
                      {r.age}
                      {isRetire && <span className="ml-1.5 rounded bg-primary px-1 py-px text-[9px] text-primary-on">RET</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-muted tabnum">{r.year}</td>
                    <td className="px-3 py-1.5 text-right">{cell(r.startingBalance)}</td>
                    <td className="px-3 py-1.5 text-right">{cell(r.contributions)}</td>
                    <td className="px-3 py-1.5 text-right">{r.lumpSums ? <span className="font-mono tabnum text-cat-4">{fmtUSD(r.lumpSums)}</span> : <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-1.5 text-right"><span className="font-mono tabnum text-success">{fmtUSD(r.investmentGrowth)}</span></td>
                    <td className="px-3 py-1.5 text-right">{cell(r.guaranteedIncome)}</td>
                    <td className="px-3 py-1.5 text-right">{r.withdrawals ? <span className="font-mono tabnum text-cat-1">{fmtUSD(r.withdrawals)}</span> : <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-1.5 text-right">{cell(r.endingBalance)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabnum text-muted">{fmtUSD(r.endingBalanceToday)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabnum text-muted">{fmtUSD(r.endingBalance)}</td>
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
