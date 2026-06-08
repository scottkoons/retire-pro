import { useMemo } from 'react';
import { useActiveScenario, useEffectiveDisplayMode, useStore } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { Section, MoneyInput, Segmented } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/tiles';
import { Grid, THead, TR, TD } from '@/components/grid/Grid';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { fmtUSD } from '@/lib/format';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

const fieldCls = 'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

export default function NetWorthPage() {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const updateHome = useStore((s) => s.updateHome);
  const rows = result.rows;
  const a = scn.assumptions;
  const home = scn.home;

  // Net worth as of right now (today), from the current inputs — independent of the
  // projection's first-year growth. Same in today's vs actual $ since it is t=0.
  const currentLiquid = scn.accounts.filter((x) => x.enabled).reduce((sum, x) => sum + x.balance, 0);
  const currentHomeEquity = home.enabled ? Math.max(0, home.currentValue - home.mortgageBalance) : 0;
  const currentLoans = (scn.liabilities ?? []).filter((l) => l.enabled).reduce((sum, l) => sum + l.balance, 0);
  const currentNetWorth = currentLiquid + currentHomeEquity - currentLoans;
  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const birth = new Date(a.birthYear, a.birthMonth, a.birthDay);
  const actualAge = Math.floor((today.getTime() - birth.getTime()) / (365.2425 * 86_400_000));

  const hasNetWorth = rows.some((r) => r.netWorth != null);

  // Home value (nominal = equity + mortgage), deflated to today's $ when requested.
  const homeValueAt = (r: (typeof rows)[number]) => {
    const nominal = (r.homeEquity ?? 0) + (r.mortgageBalance ?? 0);
    return displayMode === 'today' ? nominal / r.cpiFactor : nominal;
  };

  const homeByAge = useMemo(() => {
    const targets = new Set<number>();
    const start = Math.round(a.currentAge);
    for (let age = start; age <= Math.round(a.modelEndAge); age += 5) targets.add(age);
    targets.add(Math.round(a.retirementAge));
    targets.add(Math.round(a.modelEndAge));
    return [...targets]
      .sort((x, y) => x - y)
      .map((age) => rows.find((r) => r.age === age))
      .filter((r): r is (typeof rows)[number] => !!r);
  }, [rows, a.currentAge, a.modelEndAge, a.retirementAge]);

  const stats = useMemo(() => {
    const val = (r: (typeof rows)[number]) => (displayMode === 'today' ? r.netWorthToday ?? 0 : r.netWorth ?? 0);
    const peak = rows.reduce((m, r) => Math.max(m, val(r)), 0);
    const peakRow = rows.find((r) => val(r) === peak);
    const atRet = rows.find((r) => r.age >= Math.round(a.retirementAge));
    const last = rows[rows.length - 1];
    const peakEquity = rows.reduce((m, r) => Math.max(m, displayMode === 'today' ? (r.homeEquity ?? 0) / r.cpiFactor : r.homeEquity ?? 0), 0);
    return { peak, peakAge: peakRow?.age, atRet: atRet ? val(atRet) : 0, ending: last ? val(last) : 0, peakEquity };
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

      {/* Net worth as of today */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Current Net Worth" value={fmtUSD(currentNetWorth)} sub={`as of ${todayLabel} · age ${actualAge}`} accent="primary" />
        <StatTile label="Liquid Accounts" value={fmtUSD(currentLiquid)} sub="today" tint="blue" />
        <StatTile label="Home Equity" value={fmtUSD(currentHomeEquity)} sub="today" tint="amber" />
      </div>

      {/* Home value & appreciation — editable here */}
      <Section
        title="Home"
        subtitle="Your current home value and how fast it appreciates. Mortgage, a sale, or a planned purchase live on the Planner Sheet."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Include home">
            <Segmented
              options={[
                { value: 'on', label: 'Yes' },
                { value: 'off', label: 'No' },
              ]}
              value={home.enabled ? 'on' : 'off'}
              onChange={(v) => updateHome({ enabled: v === 'on' })}
            />
          </Field>
          <Field label="Current value">
            <MoneyInput value={home.currentValue} onChange={(n) => updateHome({ currentValue: n })} ariaLabel="Current home value" />
          </Field>
          <Field label="Appreciation % / yr">
            <input
              type="number"
              step={0.5}
              className={fieldCls}
              value={+(home.growthRate * 100).toFixed(2)}
              onChange={(e) => updateHome({ growthRate: Number(e.target.value) / 100 })}
            />
          </Field>
        </div>
        {home.enabled && home.plannedPurchase && (
          <p className="mt-3 text-[12px] text-faint">
            Note: this scenario also has a planned home purchase at age {Math.round(home.purchaseAge)} (set on the Planner), so the value below changes at that age.
          </p>
        )}
      </Section>

      {/* Home value by age */}
      {home.enabled ? (
        <Section title="Home Value by Age" subtitle={`Appreciating at ${(home.growthRate * 100).toFixed(1)}% / yr`}>
          <Grid minWidth={520}>
            <THead
              cols={[
                { label: 'Age' },
                { label: 'Home Value', align: 'right' },
                { label: 'Mortgage', align: 'right' },
                { label: 'Equity', align: 'right' },
              ]}
            />
            <tbody>
              {homeByAge.map((r) => {
                const mort = displayMode === 'today' ? (r.mortgageBalance ?? 0) / r.cpiFactor : r.mortgageBalance ?? 0;
                const eq = displayMode === 'today' ? (r.homeEquity ?? 0) / r.cpiFactor : r.homeEquity ?? 0;
                return (
                  <TR key={r.age}>
                    <TD>
                      <span className="font-mono tabnum text-ink">{r.age}</span>
                      {r.age === Math.round(a.retirementAge) && <span className="ml-2 font-mono text-[10px] uppercase text-primary">retire</span>}
                    </TD>
                    <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(homeValueAt(r))}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{mort > 0 ? fmtUSD(mort) : '—'}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(eq)}</span></TD>
                  </TR>
                );
              })}
            </tbody>
          </Grid>
        </Section>
      ) : (
        <Section title="Home is off">
          <p className="text-[14px] text-muted">Turn on “Include home” above and enter a value to see how it appreciates over time.</p>
        </Section>
      )}

      {/* Net worth composition */}
      {hasNetWorth ? (
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
      ) : (
        <Section title="Add accounts to see full net worth">
          <p className="text-[14px] text-muted">
            Add accounts on the Planner Sheet (or enable the home above) to build the tax-aware net-worth projection.
          </p>
        </Section>
      )}
    </div>
  );
}
