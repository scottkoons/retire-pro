import { useState } from 'react';
import { useActiveScenario, useEffectiveDisplayMode } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { Section, Segmented } from '@/components/ui/primitives';
import { StatTile, Slider } from '@/components/ui/tiles';
import { Grid, THead, TR, TD, useSort } from '@/components/grid/Grid';
import { CashFlowSankey } from '@/components/charts/CashFlowSankey';
import { TaxChart } from '@/components/charts/TaxChart';
import { SsClaimCompare } from '@/components/charts/SsClaimCompare';
import { fmtUSD, fmtPct } from '@/lib/format';

type Tab = 'flow' | 'taxes' | 'ss';

export default function CashFlowPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const a = scn.assumptions;
  const rows = result.rows;

  const [tab, setTab] = useState<Tab>('flow');
  const [flowAge, setFlowAge] = useState(Math.round(a.retirementAge));
  const flowRow = rows.find((r) => r.age === flowAge) ?? rows[rows.length - 1];
  const hasV2 = rows.some((r) => r.totalTax != null || r.netWorth != null);

  // Tax Detail grid (read-only): retirement-year rows, sortable by every column.
  const taxRows = rows.filter((r) => r.age >= Math.round(a.retirementAge));
  const taxSort = useSort(
    taxRows,
    {
      age: (r) => r.age,
      totalTax: (r) => r.totalTax ?? 0,
      effectiveRate: (r) => r.effectiveRate ?? 0,
      marginalRate: (r) => r.marginalRate ?? 0,
      irmaa: (r) => r.irmaa ?? 0,
      rmd: (r) => r.rmd ?? 0,
    },
    { key: 'age', dir: 'asc' },
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-head-lg text-ink">Cash Flow &amp; Taxes</h1>
          <p className="mt-1 text-[13px] text-muted">How income flows to taxes, expenses, and savings each year.</p>
        </div>
        <Segmented
          options={[
            { value: 'flow', label: 'Flow' },
            { value: 'taxes', label: 'Taxes' },
            { value: 'ss', label: 'Social Security' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {!hasV2 && (
        <Section title="Tax-aware modeling is off">
          <p className="text-[14px] text-muted">Add accounts, a home, or healthcare on the Planner Sheet to unlock cash-flow and tax analysis.</p>
        </Section>
      )}

      {hasV2 && tab === 'flow' && (
        <Section
          title={`Cash Flow at Age ${flowAge}`}
          subtitle={`Year ${flowRow?.year ?? ''}`}
          actions={
            <div className="flex w-64 items-center gap-2">
              <span className="label-mono shrink-0">Age {flowAge}</span>
              <Slider min={Math.round(a.currentAge)} max={Math.round(a.modelEndAge)} value={flowAge} onChange={setFlowAge} aria-label="Cash-flow age" />
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Guaranteed Income" value={fmtUSD(flowRow?.guaranteedIncome ?? 0)} tint="green" />
            <StatTile label="Portfolio Withdrawals" value={fmtUSD(flowRow?.withdrawals ?? 0)} tint="blue" />
            <StatTile label="Total Tax + IRMAA" value={fmtUSD((flowRow?.totalTax ?? 0) + (flowRow?.irmaa ?? 0))} accent="caution" />
            <StatTile label="Net Spendable" value={fmtUSD(flowRow?.netSpendable ?? 0)} tint="violet" />
          </div>
          {flowRow && <CashFlowSankey row={flowRow} height={400} />}
        </Section>
      )}

      {hasV2 && tab === 'taxes' && (
        <>
          <Section title="Taxes &amp; Medicare Costs by Age" subtitle="Federal, state, capital gains, NIIT, and IRMAA; line is the effective rate">
            <TaxChart rows={rows} height={360} />
          </Section>
          <Section title="Tax Detail (retirement years)">
            <Grid minWidth={620}>
              <THead
                sort={taxSort.sort}
                onSort={taxSort.onSort}
                cols={[
                  { label: 'Age', sortKey: 'age' },
                  { label: 'Total Tax', align: 'right', sortKey: 'totalTax' },
                  { label: 'Eff Rate', align: 'right', sortKey: 'effectiveRate' },
                  { label: 'Marginal', align: 'right', sortKey: 'marginalRate' },
                  { label: 'IRMAA', align: 'right', sortKey: 'irmaa' },
                  { label: 'RMD', align: 'right', sortKey: 'rmd' },
                ]}
              />
              <tbody>
                {taxSort.sorted.map((r) => (
                    <TR key={r.age}>
                      <TD><span className="font-mono tabnum text-muted">{r.age}</span></TD>
                      <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(r.totalTax ?? 0)}</span></TD>
                      <TD align="right"><span className="font-mono tabnum text-muted">{fmtPct(r.effectiveRate ?? 0)}</span></TD>
                      <TD align="right"><span className="font-mono tabnum text-muted">{fmtPct(r.marginalRate ?? 0)}</span></TD>
                      <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(r.irmaa ?? 0)}</span></TD>
                      <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(r.rmd ?? 0)}</span></TD>
                    </TR>
                  ))}
              </tbody>
            </Grid>
          </Section>
        </>
      )}

      {hasV2 && tab === 'ss' && (
        <Section title="Social Security Claiming Strategy" subtitle="Cumulative lifetime benefit by claim age, per person">
          <div className="flex flex-col gap-8">
            {scn.socialSecurity.claims.map((claim) => (
              <div key={claim.owner}>
                <div className="label-mono mb-2 text-ink">{claim.owner === 'self' ? 'Self' : 'Spouse'} · FRA benefit {fmtUSD(claim.benefitAtFRA)}/mo</div>
                <SsClaimCompare claim={claim} currentAge={claim.owner === 'spouse' ? a.currentAge + (a.spouseAgeOffset ?? 0) : a.currentAge} endAge={Math.round(a.modelEndAge)} height={300} />
              </div>
            ))}
            {scn.socialSecurity.claims.length === 0 && <p className="text-muted">No Social Security claims configured.</p>}
          </div>
          {!scn.socialSecurity.enabled && (
            <p className="mt-4 text-[12px] text-faint">
              Note: this scenario currently drives Social Security from income streams. Enable the Social Security module in Settings to use these claim ages in the projection.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
