import { useMemo, useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, MoneyInput, Segmented, Button } from '@/components/ui/primitives';
import { StatTile } from '@/components/ui/tiles';
import { Grid, THead, TR, TD, NumberInput, DeleteCell, AddRow } from '@/components/grid/Grid';
import { amortize, byYear } from '@/engine/mortgage';
import { fmtUSD, fmtPct } from '@/lib/format';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

const fieldCls = 'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Segmented
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      value={value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
    />
  );
}

export default function HomeMortgagePage() {
  const scn = useActiveScenario();
  const s = useStore();
  const home = scn.home;
  const currentAge = Math.round(scn.assumptions.currentAge);

  const balance = home.mortgageBalance;
  const rate = home.mortgageRate ?? home.loanRate;
  const term = home.mortgageTermYears ?? home.termYears;
  const extraMonthly = home.extraMonthlyPrincipal ?? 0;
  const lumps = home.extraPrincipalPayments ?? [];

  const extraLumps = useMemo(
    () =>
      lumps
        .filter((p) => p.enabled && p.amount > 0)
        .map((p) => ({ monthIndex: Math.max(0, Math.round((p.age - scn.assumptions.currentAge) * 12)), amount: p.amount })),
    [lumps, scn.assumptions.currentAge],
  );

  const withExtra = useMemo(
    () => amortize({ balance, annualRate: rate, termYears: term, extraMonthly, extraLumps }),
    [balance, rate, term, extraMonthly, extraLumps],
  );
  const baseline = useMemo(() => amortize({ balance, annualRate: rate, termYears: term }), [balance, rate, term]);
  const years = useMemo(() => byYear(withExtra), [withExtra]);

  const hasExtra = extraMonthly > 0 || extraLumps.length > 0;
  const interestSaved = baseline.totalInterest - withExtra.totalInterest;
  const monthsSaved = baseline.payoffMonths - withExtra.payoffMonths;
  const payoffMonths = withExtra.payoffMonths;
  const payoffYears = Math.floor(payoffMonths / 12);
  const payoffRemMonths = payoffMonths % 12;
  const ageAtPayoff = currentAge + payoffMonths / 12;
  const currentEquity = Math.max(0, home.currentValue - balance);

  const [detailYear, setDetailYear] = useState(1);
  const monthRows = withExtra.schedule.slice((detailYear - 1) * 12, detailYear * 12);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Home &amp; Mortgage</h1>
        <p className="mt-1 text-[13px] text-muted">
          Your home, mortgage, and extra-principal payments. Shown in actual (future) dollars.
        </p>
      </div>

      {/* Home value & appreciation */}
      <Section title="Home" subtitle="Current value and appreciation drive your home equity">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Include home in plan">
            <YesNo value={home.enabled} onChange={(v) => s.updateHome({ enabled: v })} />
          </Field>
          <Field label="Current value">
            <MoneyInput value={home.currentValue} onChange={(n) => s.updateHome({ currentValue: n })} ariaLabel="Current home value" />
          </Field>
          <Field label="Appreciation % / yr">
            <input type="number" step={0.5} className={fieldCls} value={+(home.growthRate * 100).toFixed(2)} onChange={(e) => s.updateHome({ growthRate: Number(e.target.value) / 100 })} />
          </Field>
        </div>
      </Section>

      {/* Mortgage details */}
      <Section title="Mortgage" subtitle="Enter your loan; payment and the principal/interest split are calculated">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Current balance">
            <MoneyInput value={home.mortgageBalance} onChange={(n) => s.updateHome({ mortgageBalance: n })} ariaLabel="Mortgage balance" />
          </Field>
          <Field label="Interest rate %">
            <input type="number" step={0.125} className={fieldCls} value={+(rate * 100).toFixed(3)} onChange={(e) => s.updateHome({ mortgageRate: Number(e.target.value) / 100 })} />
          </Field>
          <Field label="Remaining term (years)">
            <input type="number" step={1} className={fieldCls} value={term} onChange={(e) => s.updateHome({ mortgageTermYears: Math.max(1, Math.round(Number(e.target.value))) })} />
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Monthly Payment" value={fmtUSD(withExtra.monthlyPayment)} sub="principal & interest" tint="blue" />
          <StatTile
            label="Payoff"
            value={balance > 0 ? `${payoffYears}y ${payoffRemMonths}m` : '—'}
            sub={balance > 0 ? `at age ${ageAtPayoff.toFixed(1)}` : 'no balance'}
            tint="green"
          />
          <StatTile label="Total Interest" value={fmtUSD(withExtra.totalInterest)} tint="amber" />
          <StatTile label="Current Equity" value={fmtUSD(currentEquity)} sub="value − balance" tint="violet" />
        </div>
      </Section>

      {/* Extra principal */}
      <Section title="Extra Principal" subtitle="Pay the loan down faster — recurring and one-time payments">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Extra principal / month">
            <MoneyInput value={extraMonthly} onChange={(n) => s.updateHome({ extraMonthlyPrincipal: n })} suffix="/mo" ariaLabel="Extra monthly principal" />
          </Field>
          {hasExtra && balance > 0 && (
            <div className="flex items-end">
              <div className="rounded-lg bg-success-tint px-4 py-2.5">
                <span className="font-mono text-[12px] uppercase tracking-wide text-success">You save</span>
                <span className="ml-2 font-head text-[18px] font-bold text-ink tabnum">{fmtUSD(Math.max(0, interestSaved))}</span>
                <span className="ml-2 text-[12px] text-muted">in interest, {Math.max(0, Math.round(monthsSaved / 12 * 10) / 10)} yrs sooner</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="label-mono mb-2">One-time extra payments</div>
          <Grid minWidth={420}>
            <THead
              cols={[
                { label: 'At Age', align: 'right' },
                { label: 'Amount', align: 'right' },
                { label: 'On', align: 'center' },
              ]}
            />
            <tbody>
              {lumps.map((p) => (
                <TR key={p.id} dim={!p.enabled}>
                  <TD align="right"><NumberInput value={p.age} onChange={(v) => s.updateExtraPrincipal(p.id, { age: v })} /></TD>
                  <TD align="right"><NumberInput value={p.amount} prefix="$" onChange={(v) => s.updateExtraPrincipal(p.id, { amount: v })} /></TD>
                  <TD align="center">
                    <button
                      onClick={() => s.updateExtraPrincipal(p.id, { enabled: !p.enabled })}
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${p.enabled ? 'bg-success-tint text-success' : 'bg-input text-faint'}`}
                    >
                      {p.enabled ? 'On' : 'Off'}
                    </button>
                  </TD>
                  <DeleteCell onClick={() => s.removeExtraPrincipal(p.id)} />
                </TR>
              ))}
              {lumps.length === 0 && (
                <tr>
                  <TD align="center" className="text-faint">
                    <span className="text-[12px]">No one-time payments yet</span>
                  </TD>
                  <TD /><TD />
                  <td />
                </tr>
              )}
            </tbody>
            <AddRow colSpan={3} onClick={() => s.addExtraPrincipal()} label="Add one-time payment" />
          </Grid>
        </div>
      </Section>

      {/* Amortization schedule (yearly) */}
      {balance > 0 ? (
        <Section title="Amortization Schedule" subtitle={`${withExtra.schedule.length} months to payoff`}>
          <Grid minWidth={720}>
            <THead
              cols={[
                { label: 'Age' },
                { label: 'Paid', align: 'right' },
                { label: 'Principal', align: 'right' },
                { label: 'Interest', align: 'right' },
                { label: 'Extra', align: 'right' },
                { label: 'End Balance', align: 'right' },
                { label: 'Home Equity', align: 'right' },
              ]}
            />
            <tbody>
              {years.map((y) => {
                const yr = y.yearIndex + 1;
                const value = home.currentValue * Math.pow(1 + home.growthRate, yr);
                const equity = Math.max(0, value - y.endingBalance);
                return (
                  <TR key={y.yearIndex}>
                    <TD><span className="font-mono tabnum text-ink">{currentAge + yr}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(y.paid)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(y.principal)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(y.interest)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-success">{y.extra > 0 ? fmtUSD(y.extra) : '—'}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(y.endingBalance)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(equity)}</span></TD>
                  </TR>
                );
              })}
            </tbody>
          </Grid>

          {/* Monthly detail for a chosen year */}
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-3">
              <span className="label-mono">Monthly detail · year</span>
              <select
                className={`${fieldCls} w-24`}
                value={detailYear}
                onChange={(e) => setDetailYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y.yearIndex} value={y.yearIndex + 1}>
                    {y.yearIndex + 1} (age {currentAge + y.yearIndex + 1})
                  </option>
                ))}
              </select>
            </div>
            <Grid minWidth={560}>
              <THead
                cols={[
                  { label: 'Month' },
                  { label: 'Payment', align: 'right' },
                  { label: 'Principal', align: 'right' },
                  { label: 'Interest', align: 'right' },
                  { label: 'Extra', align: 'right' },
                  { label: 'Balance', align: 'right' },
                ]}
              />
              <tbody>
                {monthRows.map((m) => (
                  <TR key={m.month}>
                    <TD><span className="font-mono tabnum text-muted">{m.month}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(m.payment)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(m.principal)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-muted">{fmtUSD(m.interest)}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-success">{m.extra > 0 ? fmtUSD(m.extra) : '—'}</span></TD>
                    <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(m.balance)}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Grid>
          </div>
        </Section>
      ) : (
        <Section title="No mortgage">
          <p className="text-[14px] text-muted">Enter a mortgage balance above to see the payment, schedule, and equity build-up.</p>
        </Section>
      )}

      {/* Property carrying costs */}
      <Section title="Property Costs" subtitle="Ongoing costs and the Colorado disabled-veteran exemption">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="HOA $ / mo">
            <input type="number" className={fieldCls} value={home.hoaMonthly} onChange={(e) => s.updateHome({ hoaMonthly: Number(e.target.value) })} />
          </Field>
          <Field label="Property tax rate %">
            <input type="number" step={0.01} className={fieldCls} value={+(home.propertyTaxRate * 100).toFixed(3)} onChange={(e) => s.updateHome({ propertyTaxRate: Number(e.target.value) / 100 })} />
          </Field>
          <Field label="Disabled-vet exemption">
            <YesNo value={home.disabledVetExemption} onChange={(v) => s.updateHome({ disabledVetExemption: v })} />
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-faint">
          A planned home sale or purchase is configured on the Planner Sheet. Property tax is {fmtPct(home.propertyTaxRate)} of value per year{home.disabledVetExemption ? ', less the CO exemption on the first $200k' : ''}.
        </p>
      </Section>
    </div>
  );
}
