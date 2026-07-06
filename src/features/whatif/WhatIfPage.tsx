import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Scenario } from '@/domain/types';
import { useActiveScenario, useEffectiveDisplayMode, useStore } from '@/state/store';
import { runProjection } from '@/engine/project';
import { cloneScenario } from '@/domain/presets';
import { Section, Button, Segmented, StatusPill } from '@/components/ui/primitives';
import { Slider, StatTile } from '@/components/ui/tiles';
import { WealthChart } from '@/components/charts/WealthChart';
import { fmtUSD, fmtUSDAbbrev, fmtAgeYM } from '@/lib/format';
import { buildWhatIfScenario, saleAge, whatIfName, type SaleInput, type WhatIfInputs } from './buildWhatIf';

/** Pinned snapshot for quick A/B comparison of slider positions. */
interface Pin {
  name: string;
  balRet: number;
  monthly: number;
  ending: number;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  sub,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  sub?: string;
}) {
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="label-mono">{label}</span>
        <span className="font-semibold text-ink tabnum text-[14px]">
          {format(value)}
          {sub && <span className="ml-1.5 font-normal text-[11px] text-muted">{sub}</span>}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

function RestaurantCard({
  label,
  input,
  onChange,
  yearMin,
  yearMax,
  assumptions,
}: {
  label: string;
  input: SaleInput;
  onChange: (patch: Partial<SaleInput>) => void;
  yearMin: number;
  yearMax: number;
  assumptions: Scenario['assumptions'];
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-ink">{label}</span>
        <Segmented
          size="sm"
          options={[
            { value: 'keep', label: 'Keep' },
            { value: 'cash', label: 'Sell / Dissolve' },
          ]}
          value={input.cashOut ? 'cash' : 'keep'}
          onChange={(v) => onChange({ cashOut: v === 'cash' })}
        />
      </div>
      {input.cashOut && (
        <>
          <SliderRow
            label="When"
            value={input.year}
            min={yearMin}
            max={yearMax}
            step={1}
            onChange={(year) => onChange({ year })}
            format={(y) => String(y)}
            sub={fmtAgeYM(saleAge(input.year, assumptions))}
          />
          <SliderRow
            label="Proceeds"
            value={input.amount}
            min={0}
            max={2_000_000}
            step={25_000}
            onChange={(amount) => onChange({ amount })}
            format={(v) => fmtUSDAbbrev(v)}
          />
        </>
      )}
    </div>
  );
}

export default function WhatIfPage() {
  const navigate = useNavigate();
  const base = useActiveScenario();
  const settings = useStore((s) => s.settings);
  const addScenario = useStore((s) => s.addScenario);
  const displayMode = useEffectiveDisplayMode();
  const setOverride = useStore((s) => s.setDisplayModeOverride);
  const a = base.assumptions;

  const nowYear = a.birthYear + Math.floor(a.currentAge) + 1; // first full slider year
  const yearMax = a.birthYear + 75;

  // Default the "own both" tier to the contribution you are making today.
  const currentContrib =
    base.contributions.filter((c) => c.enabled && c.startAge <= a.currentAge + 1 && c.monthlyAmount > 0)[0]?.monthlyAmount ?? 7_000;

  const [inputs, setInputs] = useState<WhatIfInputs>(() => ({
    retirementAge: Math.round(a.retirementAge),
    roundhouse: { cashOut: true, year: Math.min(nowYear + 3, yearMax), amount: 300_000 },
    interquest: { cashOut: true, year: Math.min(a.birthYear + Math.round(a.retirementAge), yearMax), amount: 900_000 },
    contribBoth: Math.round(currentContrib / 250) * 250,
    contribOne: 3_000,
    contribNone: 1_000,
  }));
  const [pin, setPin] = useState<Pin | null>(null);

  const patch = (p: Partial<WhatIfInputs>) => setInputs((s) => ({ ...s, ...p }));

  // Live projection: synthesize a scenario from the sliders and run the same
  // engine the dashboard uses. Nothing here touches saved scenarios.
  const { scn, result } = useMemo(() => {
    const scn = buildWhatIfScenario(base, inputs);
    return { scn, result: runProjection(scn, settings).result };
  }, [base, settings, inputs]);

  const balRet = displayMode === 'today' ? result.projectedBalanceAtRetirementToday : result.projectedBalanceAtRetirement;
  const ending = displayMode === 'today' ? result.endingBalanceToday : result.endingBalance;
  const monthly = result.monthlyIncomeAtRetirement;

  const makeScenario = () => {
    const real = cloneScenario(scn, whatIfName(inputs), new Date().toISOString());
    addScenario(real);
    navigate('/');
  };

  const delta = (cur: number, pinned: number) => {
    const d = cur - pinned;
    if (Math.abs(d) < 1) return 'same';
    return `${d > 0 ? '+' : '−'}${fmtUSDAbbrev(Math.abs(d))} vs pin`;
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-head-lg text-ink">What-If Explorer</h1>
          <p className="mt-1 text-[13px] text-muted">
            Quick estimates only — slide the sale timing, proceeds, and contributions to see the effect.
            Starts from “{base.name}” settings; saved scenarios are never changed.
          </p>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <RestaurantCard
            label="Roundhouse"
            input={inputs.roundhouse}
            onChange={(p) => patch({ roundhouse: { ...inputs.roundhouse, ...p } })}
            yearMin={nowYear}
            yearMax={yearMax}
            assumptions={a}
          />
          <RestaurantCard
            label="Interquest"
            input={inputs.interquest}
            onChange={(p) => patch({ interquest: { ...inputs.interquest, ...p } })}
            yearMin={nowYear}
            yearMax={yearMax}
            assumptions={a}
          />

          <div className="rounded-xl border border-border-subtle bg-card p-4">
            <div className="mb-1 text-[14px] font-semibold text-ink">Monthly contributions</div>
            <p className="mb-2 text-[12px] text-muted">
              Tied to ownership, not dates — the windows move with the sale sliders. Contributions stop at retirement.
            </p>
            <SliderRow
              label="While owning both"
              value={inputs.contribBoth}
              min={0}
              max={15_000}
              step={250}
              onChange={(contribBoth) => patch({ contribBoth })}
              format={(v) => `${fmtUSD(v)}/mo`}
            />
            <SliderRow
              label="After first sale/dissolution"
              value={inputs.contribOne}
              min={0}
              max={15_000}
              step={250}
              onChange={(contribOne) => patch({ contribOne })}
              format={(v) => `${fmtUSD(v)}/mo`}
            />
            <SliderRow
              label="After both are gone"
              value={inputs.contribNone}
              min={0}
              max={15_000}
              step={250}
              onChange={(contribNone) => patch({ contribNone })}
              format={(v) => `${fmtUSD(v)}/mo`}
            />
          </div>

          <div className="rounded-xl border border-border-subtle bg-card p-4">
            <SliderRow
              label="Retirement age"
              value={inputs.retirementAge}
              min={Math.max(58, Math.ceil(a.currentAge))}
              max={72}
              step={1}
              onChange={(retirementAge) => patch({ retirementAge })}
              format={(v) => `${v}`}
              sub={`${a.birthYear + inputs.retirementAge}`}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Balance at Retirement"
              value={fmtUSD(balRet)}
              sub={pin ? delta(balRet, pin.balRet) : displayMode === 'today' ? "today's $" : 'actual $'}
              tint="amber"
            />
            <StatTile
              label="Monthly Income"
              value={fmtUSD(monthly)}
              sub={pin ? delta(monthly, pin.monthly) : `${fmtUSD(monthly * 12)} / yr`}
              tint="green"
            />
            <StatTile
              label="End of Horizon"
              value={fmtUSD(ending)}
              sub={
                pin
                  ? delta(ending, pin.ending)
                  : result.depletionAge != null
                    ? `depletes at ${fmtAgeYM(result.depletionAge)}`
                    : `at age ${Math.round(a.modelEndAge)}`
              }
              tint="blue"
            />
          </div>

          <Section
            title="Projected Wealth"
            subtitle={pin ? `Pinned: ${pin.name}` : 'Pin the current sliders to compare against another position'}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPin(pin ? null : { name: whatIfName(inputs), balRet, monthly, ending })}
                >
                  {pin ? 'Clear pin' : 'Pin baseline'}
                </Button>
                <Button size="sm" onClick={makeScenario}>Make it a scenario</Button>
              </div>
            }
          >
            <WealthChart
              rows={result.rows}
              markers={result.markers}
              retireAge={Math.round(inputs.retirementAge)}
              displayMode={displayMode}
              range="MAX"
              currentAge={a.currentAge}
              height={320}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted">
              <span>{whatIfName(inputs)}</span>
              <StatusPill status={result.status} />
            </div>
          </Section>

          <p className="text-[12px] text-faint">
            Uses “{base.name}” for income streams, Social Security, withdrawal strategy, return, and inflation.
            Only the sale events and contribution tiers above are modeled — other one-time events from the scenario
            are not included here. “Make it a scenario” saves this exact setup as a new scenario you can tweak in detail.
          </p>
        </div>
      </div>
    </div>
  );
}
