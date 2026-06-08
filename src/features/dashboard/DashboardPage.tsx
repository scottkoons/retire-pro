import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveScenario, useEffectiveDisplayMode, useStore } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { useMcStore, mcConfigHash } from '@/state/mcStore';
import { incomeBreakdownAtAge } from '@/engine/project';
import { ageToMonthIndex, monthlyRate } from '@/engine/timeline';
import { Section, Button, Segmented, TaxChip } from '@/components/ui/primitives';
import { ControlTile, Slider, StatTile, SummaryTile, BarRow } from '@/components/ui/tiles';
import { WealthChart } from '@/components/charts/WealthChart';
import { IncomeChart, type IncomePoint } from '@/components/charts/IncomeChart';
import { ScenarioRail } from './ScenarioRail';
import { ReturnPhasesPanel } from './ReturnPhasesPanel';
import { IconCalendar, IconBank, IconDice, IconDiamond, IconChevronLeft } from '@/components/icons';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev, pctValue } from '@/lib/format';

// Enable the Monte Carlo overlay once per session on the first dashboard view.
let bandAutoEnabled = false;

export default function DashboardPage() {
  const navigate = useNavigate();
  const scn = useActiveScenario();
  const { result, months } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const setAssumption = useStore((s) => s.setAssumption);
  const setWithdrawal = useStore((s) => s.setWithdrawal);
  const settings = useStore((s) => s.settings);
  const ui = useStore((s) => s.ui);
  const toggleMcBand = useStore((s) => s.toggleMcBand);
  const setChartRange = useStore((s) => s.setChartRange);
  const setOverride = useStore((s) => s.setDisplayModeOverride);
  const toggleRail = useStore((s) => s.toggleRail);

  const mc = useMcStore();
  const a = scn.assumptions;
  const inflM = monthlyRate(a.inflation);
  const cpiAt = (age: number) => Math.pow(1 + inflM, ageToMonthIndex(age, a.currentAge));
  const deflate = (nominal: number, age: number) => (displayMode === 'today' ? nominal / cpiAt(age) : nominal);

  const [breakdownAge, setBreakdownAge] = useState(Math.round(a.retirementAge));
  const breakdown = useMemo(() => incomeBreakdownAtAge(scn, months, breakdownAge), [scn, months, breakdownAge]);

  const incomeSeries = useMemo<IncomePoint[]>(() => {
    const pts: IncomePoint[] = [];
    for (let age = Math.round(a.currentAge); age <= Math.round(a.modelEndAge); age++) {
      const bd = incomeBreakdownAtAge(scn, months, age);
      const p: IncomePoint = { age, investment: 0, va: 0, ssSelf: 0, ssSpouse: 0, other: 0 };
      for (const c of bd.components) {
        const annual = deflate(c.monthlyNominal * 12, age);
        if (c.cat === 1) p.investment += annual;
        else if (c.cat === 2) p.va += annual;
        else if (c.cat === 3) p.ssSelf += annual;
        else if (c.cat === 4) p.ssSpouse += annual;
        else p.other += annual;
      }
      pts.push(p);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scn, months, displayMode]);

  const currentHash = mcConfigHash(scn, settings, 'survival');
  const mcFresh = mc.result && mc.configHash === currentHash;

  const balRetire = displayMode === 'today' ? result.projectedBalanceAtRetirementToday : result.projectedBalanceAtRetirement;
  // Principal still invested at the end of the plan horizon (modelEndAge).
  const endHorizon = displayMode === 'today' ? result.endingBalanceToday : result.endingBalance;
  const currentAssets = scn.accounts.filter((x) => x.enabled).reduce((sum, x) => sum + x.balance, 0);
  const monthlyIncome = deflate(result.monthlyIncomeAtRetirement, a.retirementAge);
  const maxComponent = Math.max(1, ...breakdown.components.map((c) => c.monthlyNominal));

  // On first dashboard view this session: make sure Monte Carlo has a fresh result and show the overlay.
  useEffect(() => {
    const stale = !mc.result || mc.configHash !== currentHash;
    if (stale && !mc.running) mc.run(scn, settings);
    if (!bandAutoEnabled) {
      bandAutoEnabled = true;
      if (!ui.showMonteCarloBand) toggleMcBand(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleBand = () => {
    const turningOn = !ui.showMonteCarloBand;
    toggleMcBand();
    if (turningOn && !mc.running && (!mc.result || !mcFresh)) mc.run(scn, settings);
  };

  const bandActive = ui.showMonteCarloBand && !!mc.result;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* MAIN COLUMN */}
      <div className={`flex min-w-0 flex-col gap-6 ${ui.railCollapsed ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
        {/* Tiles */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {ui.railCollapsed && (
              <button
                type="button"
                onClick={() => toggleRail(false)}
                title="Show scenario inputs"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-primary hover:text-ink"
              >
                <IconChevronLeft className="h-4 w-4" />
                <IconDiamond className="h-3 w-3 text-primary" /> Scenario inputs
              </button>
            )}
            <span className="label-mono ml-auto">Show amounts in</span>
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Balance at Retirement" value={fmtUSD(balRetire)} sub={displayMode === 'today' ? "today's $" : 'actual $'} tint="amber" />
            <StatTile label="Monthly Income" value={fmtUSD(monthlyIncome)} sub={`at age ${Math.round(a.retirementAge)}`} tint="green" />
            <StatTile label="Annual Income" value={fmtUSD(monthlyIncome * 12)} tint="violet" />
            <StatTile label={`End of Horizon (${Math.round(a.modelEndAge)})`} value={fmtUSD(endHorizon)} sub="Remaining principal" tint="blue" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ControlTile label="Target Retirement Age" icon={<IconCalendar className="h-5 w-5" />} value={Math.round(a.retirementAge)} unit="years">
              <Slider min={50} max={75} value={Math.round(a.retirementAge)} onChange={(v) => setAssumption('retirementAge', v)} aria-label="Retirement age" />
            </ControlTile>
            <ControlTile label="Starting Amount" icon={<IconBank className="h-5 w-5" />} value={fmtUSDAbbrev(currentAssets)}>
              {/* Read-only: the starting amount is the total of your accounts. Edit balances in the Planner. */}
              <button
                type="button"
                onClick={() => navigate('/planner')}
                title="Total of your accounts — edit balances in the Planner"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-input px-3 py-2 text-left transition-colors hover:border-primary"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">Accounts</span>
                <span className="font-mono tabnum text-[13px] font-semibold text-ink">{fmtUSD(currentAssets)}</span>
              </button>
            </ControlTile>
            <ControlTile label="Withdrawal Rate" value={pctValue(scn.withdrawal.rate ?? 0.04, 2)} unit="%">
              <Slider min={0.02} max={0.08} step={0.0025} value={scn.withdrawal.rate ?? 0.04} onChange={(v) => setWithdrawal({ rate: v })} aria-label="Withdrawal rate" />
            </ControlTile>
            <ControlTile label="Inflation" value={pctValue(a.inflation)} unit="%">
              <Slider min={0} max={0.06} step={0.001} value={a.inflation} onChange={(v) => setAssumption('inflation', v)} aria-label="Inflation" />
            </ControlTile>
          </div>

          <ReturnPhasesPanel />
        </div>

        {/* Wealth chart */}
        <Section
          eyebrow={<><IconDiamond className="h-3 w-3 text-primary" /> Projected Wealth Growth</>}
          title="Projected Wealth Growth"
          subtitle="Long-term portfolio estimation based on current parameters"
          actions={
            <div className="flex items-center gap-2">
              <Button variant={ui.showMonteCarloBand ? 'primary' : 'ghost'} size="sm" onClick={onToggleBand}>
                MC Overlay
              </Button>
              <Button variant="outline" size="sm" onClick={() => mc.run(scn, settings)} disabled={mc.running}>
                <IconDice className="h-4 w-4" /> {mc.running ? `Running ${Math.round(mc.progress * 100)}%` : 'Run Monte Carlo'}
              </Button>
              <Segmented
                size="sm"
                options={[
                  { value: '10Y', label: '10Y' },
                  { value: 'MAX', label: 'MAX' },
                ]}
                value={ui.chartRange}
                onChange={(v) => setChartRange(v)}
              />
            </div>
          }
        >
          <WealthChart
            rows={result.rows}
            markers={result.markers}
            retireAge={Math.round(a.retirementAge)}
            displayMode={displayMode}
            range={ui.chartRange}
            currentAge={Math.round(a.currentAge)}
            band={ui.showMonteCarloBand && mc.result ? mc.result.percentileSeries : undefined}
            height={420}
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-faint">
            <span>Current Age ({Math.round(a.currentAge)})</span>
            <span>Retirement ({Math.round(a.retirementAge)})</span>
            <span>End of Plan ({Math.round(a.modelEndAge)})</span>
          </div>
          {bandActive && mc.result && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border-subtle pt-3 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: chart.band, opacity: 0.4 }} /> Monte Carlo range (P10–P90)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: chart.band }} /> MC median (P50)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: chart.primary }} /> Projected (deterministic)
              </span>
              <span className="ml-auto">
                {mc.result.paths.toLocaleString()} simulations
                {!mcFresh && <span className="ml-2 text-caution">· stale, re-run</span>}
              </span>
            </div>
          )}
        </Section>

        {/* Income breakdown — moved below the wealth graph */}
        <Section
          eyebrow={<><IconDiamond className="h-3 w-3 text-primary" /> Income Breakdown</>}
          title={<span className="text-[20px]">Income Breakdown</span>}
          subtitle={`at age ${breakdownAge} · ${scn.name}`}
          actions={
            <div className="flex w-56 items-center gap-2">
              <span className="label-mono shrink-0">Age {breakdownAge}</span>
              <Slider min={Math.round(a.currentAge)} max={Math.round(a.modelEndAge)} value={breakdownAge} onChange={setBreakdownAge} aria-label="Breakdown age" />
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              {breakdown.components.map((c, i) => (
                <BarRow
                  key={i}
                  label={c.label}
                  value={fmtUSD(deflate(c.monthlyNominal, breakdownAge))}
                  fraction={c.monthlyNominal / maxComponent}
                  color={chart.cat[c.cat]}
                  chip={<TaxChip status={c.taxStatus} />}
                  sublabel={c.fromAgeNote}
                />
              ))}
              {breakdown.components.length === 0 && <p className="py-6 text-center text-muted">No active income at this age.</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:content-start">
              <SummaryTile label="Taxable / mo" value={fmtUSD(deflate(breakdown.taxablePerMo, breakdownAge))} tone="tax" />
              <SummaryTile label="Tax-free / mo" value={fmtUSD(deflate(breakdown.taxFreePerMo, breakdownAge))} tone="tax-free" />
            </div>
          </div>
        </Section>

        {/* Income over time */}
        <Section title={<span className="text-[20px]">Income Sources Over Time</span>} subtitle="Projected annual income sources through retirement">
          <IncomeChart data={incomeSeries} height={300} />
        </Section>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/planner')}>Open Planner Sheet</Button>
          <Button variant="outline" onClick={() => navigate('/summary')}>Open Plan Summary</Button>
        </div>
      </div>

      {/* RIGHT RAIL — scenario inputs (collapsible) */}
      {!ui.railCollapsed && (
        <div className="xl:col-span-4">
          <ScenarioRail />
        </div>
      )}
    </div>
  );
}
