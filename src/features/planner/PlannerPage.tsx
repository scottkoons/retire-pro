import { useActiveScenario, useStore, useEffectiveDisplayMode } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import {
  Grid,
  THead,
  TR,
  TD,
  DeleteCell,
  AddRow,
  TotalRow,
  TextInput,
  NumberInput,
  SelectInput,
  MonthYearInput,
} from '@/components/grid/Grid';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';
import { ageFromISO, isoFromAge, isoFromMonthValue, monthValueFromISO } from '@/lib/dates';
import type { DollarBasis, TaxStatus, WithdrawalType } from '@/domain/types';

const basisOpts: { value: DollarBasis; label: string }[] = [
  { value: 'today', label: "Today's $" },
  { value: 'actual', label: 'Actual $' },
];
const taxOpts: { value: TaxStatus; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax-free', label: 'Tax-free' },
];

function streamNominalAtAge(todayMonthly: number, cola: number, inflationAdjusted: boolean, ageDelta: number): number {
  if (!inflationAdjusted) return todayMonthly;
  return todayMonthly * Math.pow(1 + cola, ageDelta);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

export default function PlannerPage() {
  const scn = useActiveScenario();
  const displayMode = useEffectiveDisplayMode();
  const a = scn.assumptions;
  const s = useStore();

  const fieldCls = 'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

  const totalLumps = scn.lumpSums.filter((l) => l.enabled).reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Planner Sheet</h1>
        <p className="mt-1 text-[13px] text-muted">
          Every edit here updates the Dashboard and Plan Summary instantly.{' '}
          <span className="ml-1 rounded bg-input px-2 py-0.5 font-mono text-[11px] text-muted">{displayMode === 'today' ? "today's $" : 'actual $'}</span>
        </p>
      </div>

      {/* Basics */}
      <Section title="Basics">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Current Age">
            <input type="number" className={fieldCls} value={a.currentAge} onChange={(e) => s.setAssumption('currentAge', Number(e.target.value))} />
          </Field>
          <Field label="Retirement Age">
            <input type="number" className={fieldCls} value={a.retirementAge} onChange={(e) => s.setAssumption('retirementAge', Number(e.target.value))} />
          </Field>
          <Field label="Model End Age">
            <input type="number" className={fieldCls} value={a.modelEndAge} onChange={(e) => s.setAssumption('modelEndAge', Number(e.target.value))} />
          </Field>
          <Field label="Starting Balance">
            <input type="number" className={fieldCls} value={a.startingBalance} onChange={(e) => s.setAssumption('startingBalance', Number(e.target.value))} />
          </Field>
          <Field label="Annual Return %">
            <input type="number" step={0.1} className={fieldCls} value={+(a.annualReturn * 100).toFixed(2)} onChange={(e) => s.setAssumption('annualReturn', Number(e.target.value) / 100)} />
          </Field>
          <Field label="Inflation %">
            <input type="number" step={0.1} className={fieldCls} value={+(a.inflation * 100).toFixed(2)} onChange={(e) => s.setAssumption('inflation', Number(e.target.value) / 100)} />
          </Field>
        </div>
      </Section>

      {/* Monthly Contributions */}
      <Section title="Monthly Contributions" subtitle={`${scn.contributions.length} rows`}>
        <Grid minWidth={760}>
          <THead
            cols={[
              { label: 'Name', w: '24%' },
              { label: 'Start' },
              { label: 'End' },
              { label: 'Monthly $', align: 'right' },
              { label: 'Basis' },
              { label: 'Months', align: 'right' },
              { label: 'Total', align: 'right' },
            ]}
          />
          <tbody>
            {scn.contributions.map((c) => {
              const months = Math.max(0, Math.round((c.endAge - c.startAge) * 12));
              return (
                <TR key={c.id} dim={!c.enabled}>
                  <TD><TextInput value={c.name} onChange={(v) => s.updateContribution(c.id, { name: v })} /></TD>
                  <TD>
                    <MonthYearInput
                      value={monthValueFromISO(c.startDateOverride ?? isoFromAge(c.startAge, a))}
                      onChange={(v) => {
                        const iso = isoFromMonthValue(v);
                        if (iso) s.updateContribution(c.id, { startDateOverride: iso, startAge: ageFromISO(iso, a) });
                      }}
                    />
                  </TD>
                  <TD>
                    <MonthYearInput
                      value={monthValueFromISO(c.endDateOverride ?? isoFromAge(c.endAge, a))}
                      onChange={(v) => {
                        const iso = isoFromMonthValue(v);
                        if (iso) s.updateContribution(c.id, { endDateOverride: iso, endAge: ageFromISO(iso, a) });
                      }}
                    />
                  </TD>
                  <TD align="right"><NumberInput value={c.monthlyAmount} prefix="$" onChange={(v) => s.updateContribution(c.id, { monthlyAmount: v })} /></TD>
                  <TD><SelectInput value={c.dollarBasis} options={basisOpts} onChange={(v) => s.updateContribution(c.id, { dollarBasis: v })} /></TD>
                  <TD align="right"><span className="font-mono text-muted tabnum">{months}</span></TD>
                  <TD align="right"><span className="font-mono text-ink tabnum">{fmtUSD(months * c.monthlyAmount)}</span></TD>
                  <DeleteCell onClick={() => s.removeContribution(c.id)} />
                </TR>
              );
            })}
          </tbody>
          <AddRow colSpan={7} onClick={s.addContribution} />
        </Grid>
      </Section>

      {/* Lump Sum Events */}
      <Section title="Lump Sum Events" subtitle="Shown as dots on the wealth chart">
        <Grid minWidth={720}>
          <THead
            cols={[
              { label: 'Name', w: '30%' },
              { label: 'Date' },
              { label: 'Age', align: 'right' },
              { label: 'Amount', align: 'right' },
              { label: 'Basis' },
              { label: 'Tax' },
            ]}
          />
          <tbody>
            {scn.lumpSums.map((l) => (
              <TR key={l.id} dim={!l.enabled}>
                <TD><TextInput value={l.name} onChange={(v) => s.updateLumpSum(l.id, { name: v })} /></TD>
                <TD>
                  <MonthYearInput
                    value={monthValueFromISO(l.dateOverride ?? isoFromAge(l.age, a))}
                    onChange={(v) => {
                      const iso = isoFromMonthValue(v);
                      if (iso) s.updateLumpSum(l.id, { dateOverride: iso, age: ageFromISO(iso, a) });
                    }}
                  />
                </TD>
                <TD align="right"><span className="font-mono text-muted tabnum">{(l.dateOverride ? ageFromISO(l.dateOverride, a) : l.age).toFixed(1)}</span></TD>
                <TD align="right"><NumberInput value={l.amount} prefix="$" onChange={(v) => s.updateLumpSum(l.id, { amount: v })} /></TD>
                <TD><SelectInput value={l.dollarBasis} options={basisOpts} onChange={(v) => s.updateLumpSum(l.id, { dollarBasis: v })} /></TD>
                <TD><SelectInput value={l.taxStatus ?? 'taxable'} options={taxOpts} onChange={(v) => s.updateLumpSum(l.id, { taxStatus: v })} /></TD>
                <DeleteCell onClick={() => s.removeLumpSum(l.id)} />
              </TR>
            ))}
          </tbody>
          <AddRow colSpan={6} onClick={s.addLumpSum} />
          <tbody>
            <TotalRow>
              <TD>Total lump sums</TD>
              <TD /><TD /><TD align="right"><span className="font-mono text-ink tabnum">{fmtUSDAbbrev(totalLumps)}</span></TD><TD /><TD />
              <td />
            </TotalRow>
          </tbody>
        </Grid>
      </Section>

      {/* Income Streams */}
      <Section title="Retirement Income Streams" subtitle="Entered in today's dollars; COLA compounds from today">
        <Grid minWidth={860}>
          <THead
            cols={[
              { label: 'Source', w: '22%' },
              { label: "Today $/mo", align: 'right' },
              { label: 'Start', align: 'right' },
              { label: 'End', align: 'right' },
              { label: 'COLA %', align: 'right' },
              { label: 'Owner' },
              { label: 'Tax' },
              { label: `@ ${Math.round(a.retirementAge)}`, align: 'right' },
              { label: '@ 90', align: 'right' },
            ]}
          />
          <tbody>
            {scn.incomeStreams.map((st) => {
              const cola = st.cola ?? a.inflation;
              const atRet = streamNominalAtAge(st.monthlyAmountToday, cola, st.inflationAdjusted, a.retirementAge - a.currentAge);
              const at90 = streamNominalAtAge(st.monthlyAmountToday, cola, st.inflationAdjusted, 90 - a.currentAge);
              return (
                <TR key={st.id} dim={!st.enabled}>
                  <TD><TextInput value={st.name} onChange={(v) => s.updateIncomeStream(st.id, { name: v })} /></TD>
                  <TD align="right"><NumberInput value={st.monthlyAmountToday} prefix="$" onChange={(v) => s.updateIncomeStream(st.id, { monthlyAmountToday: v })} /></TD>
                  <TD align="right"><NumberInput value={st.startAge} onChange={(v) => s.updateIncomeStream(st.id, { startAge: v })} /></TD>
                  <TD align="right"><NumberInput value={st.endAge} onChange={(v) => s.updateIncomeStream(st.id, { endAge: v })} /></TD>
                  <TD align="right"><NumberInput value={+((st.cola ?? a.inflation) * 100).toFixed(1)} suffix="%" onChange={(v) => s.updateIncomeStream(st.id, { cola: v / 100 })} /></TD>
                  <TD><SelectInput value={st.owner} options={[{ value: 'self', label: 'Self' }, { value: 'spouse', label: 'Spouse' }]} onChange={(v) => s.updateIncomeStream(st.id, { owner: v })} /></TD>
                  <TD><SelectInput value={st.taxStatus} options={taxOpts} onChange={(v) => s.updateIncomeStream(st.id, { taxStatus: v })} /></TD>
                  <TD align="right"><span className="font-mono text-muted tabnum">{fmtUSD(atRet)}</span></TD>
                  <TD align="right"><span className="font-mono text-muted tabnum">{fmtUSD(at90)}</span></TD>
                  <DeleteCell onClick={() => s.removeIncomeStream(st.id)} />
                </TR>
              );
            })}
          </tbody>
          <AddRow colSpan={9} onClick={s.addIncomeStream} />
        </Grid>
      </Section>

      {/* Withdrawal Strategy */}
      <Section title="Withdrawal Strategy">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select
              className={fieldCls}
              value={scn.withdrawal.type}
              onChange={(e) => s.setWithdrawal({ type: e.target.value as WithdrawalType })}
            >
              <option value="percent-of-balance">Percentage of balance</option>
              <option value="fixed-amount">Fixed amount / yr</option>
              <option value="target-income">Target income (phases)</option>
            </select>
          </Field>
          {scn.withdrawal.type === 'percent-of-balance' ? (
            <Field label="Rate % / yr">
              <input type="number" step={0.25} className={fieldCls} value={+(((scn.withdrawal.rate ?? 0.04) * 100).toFixed(2))} onChange={(e) => s.setWithdrawal({ rate: Number(e.target.value) / 100 })} />
            </Field>
          ) : scn.withdrawal.type === 'fixed-amount' ? (
            <Field label="Amount / yr (today's $)">
              <input type="number" className={fieldCls} value={scn.withdrawal.amount ?? 0} onChange={(e) => s.setWithdrawal({ amount: Number(e.target.value) })} />
            </Field>
          ) : (
            <Field label="Driven by">
              <div className={`${fieldCls} text-muted`}>Retirement Phase targets</div>
            </Field>
          )}
          <Field label="Tax status">
            <select className={fieldCls} value={scn.withdrawal.taxStatus} onChange={(e) => s.setWithdrawal({ taxStatus: e.target.value as TaxStatus })}>
              <option value="taxable">Taxable</option>
              <option value="tax-free">Tax-free</option>
            </select>
          </Field>
        </div>
      </Section>
    </div>
  );
}
