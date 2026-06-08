import { Link } from 'react-router-dom';
import { useActiveScenario, useStore } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import { Grid, THead, TR, TD, TextInput, NumberInput, SelectInput, DeleteCell, AddRow } from '@/components/grid/Grid';
import { fmtUSD, fmtDate, todayISO } from '@/lib/format';
import type { LoanKind } from '@/domain/types';

const kindOpts: { value: LoanKind; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'student', label: 'Student' },
  { value: 'personal', label: 'Personal' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
];

export function LoansManager() {
  const scn = useActiveScenario();
  const s = useStore();
  const loans = scn.liabilities ?? [];
  const total = loans.filter((l) => l.enabled).reduce((sum, l) => sum + l.balance, 0);

  return (
    <Section
      title="Loans"
      subtitle="Car and other loans. Your home mortgage is on the Home & Mortgage page."
    >
      <Grid minWidth={720}>
        <THead
          cols={[
            { label: 'Loan', w: '26%' },
            { label: 'Type' },
            { label: 'Balance', align: 'right' },
            { label: 'Rate %', align: 'right' },
            { label: 'Payment / mo', align: 'right' },
            { label: 'Updated', align: 'right' },
          ]}
        />
        <tbody>
          {loans.map((l) => (
            <TR key={l.id} dim={!l.enabled}>
              <TD><TextInput value={l.name} onChange={(v) => s.updateLoan(l.id, { name: v })} /></TD>
              <TD><SelectInput value={l.kind} options={kindOpts} onChange={(v) => s.updateLoan(l.id, { kind: v })} /></TD>
              <TD align="right"><NumberInput value={l.balance} prefix="$" onChange={(v) => s.updateLoan(l.id, { balance: v, lastUpdated: todayISO() })} /></TD>
              <TD align="right"><NumberInput value={+(l.rate * 100).toFixed(3)} suffix="%" onChange={(v) => s.updateLoan(l.id, { rate: v / 100 })} /></TD>
              <TD align="right"><NumberInput value={l.monthlyPayment} prefix="$" onChange={(v) => s.updateLoan(l.id, { monthlyPayment: v })} /></TD>
              <TD align="right"><span className="font-mono text-[11px] text-muted">{l.lastUpdated ? fmtDate(l.lastUpdated) : '—'}</span></TD>
              <DeleteCell onClick={() => s.removeLoan(l.id)} />
            </TR>
          ))}
          {loans.length === 0 && (
            <tr>
              <TD className="text-faint"><span className="text-[12px]">No loans yet</span></TD>
              <TD /><TD /><TD /><TD /><TD />
              <td />
            </tr>
          )}
        </tbody>
        <AddRow colSpan={6} onClick={() => s.addLoan()} label="Add loan" />
      </Grid>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-error-tint px-4 py-3">
        <span className="font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-error">Total loan balances</span>
        <span className="font-head text-[18px] font-bold text-ink tabnum">{fmtUSD(total)}</span>
      </div>
      <p className="mt-2 text-[12px] text-faint">
        Leave Payment at $0 to let the plan estimate one (5-year payoff). These balances reduce your net worth.{' '}
        Mortgage details and extra principal live on <Link to="/home" className="text-primary hover:underline">Home &amp; Mortgage</Link>.
      </p>
    </Section>
  );
}
