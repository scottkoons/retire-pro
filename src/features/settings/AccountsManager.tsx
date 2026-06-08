import { useActiveScenario, useStore } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import { Grid, THead, TR, TD, TextInput, NumberInput, SelectInput, DeleteCell, AddRow } from '@/components/grid/Grid';
import { fmtUSD, fmtUSDAbbrev, fmtDate, todayISO } from '@/lib/format';
import type { AccountKind, Owner } from '@/domain/types';

const GROUPS: { kind: AccountKind; label: string; help: string }[] = [
  { kind: 'pretax', label: 'Pre-tax (401k, Traditional IRA)', help: 'Taxed as income when withdrawn' },
  { kind: 'roth', label: 'Tax-free (Roth)', help: 'Never taxed' },
  { kind: 'taxable', label: 'Taxable (brokerage, cash value, other)', help: 'Capital gains on growth' },
];

const ownerOpts: { value: Owner; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
];

export function AccountsManager() {
  const scn = useActiveScenario();
  const s = useStore();
  const accounts = scn.accounts;
  const total = accounts.filter((a) => a.enabled).reduce((sum, a) => sum + a.balance, 0);

  return (
    <Section title="Accounts & Assets" subtitle="Your current balances by tax type; the total feeds the Dashboard and Net Worth">
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => {
          const list = accounts.filter((a) => a.kind === g.kind);
          const subtotal = list.filter((a) => a.enabled).reduce((sum, a) => sum + a.balance, 0);
          return (
            <div key={g.kind}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[14px] font-semibold text-ink">{g.label}</span>
                  <span className="ml-2 text-[12px] text-faint">{g.help}</span>
                </div>
                <span className="font-mono tabnum text-[14px] font-semibold text-ink">{fmtUSD(subtotal)}</span>
              </div>
              <Grid minWidth={640}>
                <THead
                  cols={[
                    { label: 'Account', w: '34%' },
                    { label: 'Amount', align: 'right' },
                    { label: 'Owner' },
                    { label: 'Updated', align: 'right' },
                  ]}
                />
                <tbody>
                  {list.map((acc) => (
                    <TR key={acc.id} dim={!acc.enabled}>
                      <TD><TextInput value={acc.name} onChange={(v) => s.updateAccount(acc.id, { name: v })} /></TD>
                      <TD align="right">
                        <NumberInput value={acc.balance} prefix="$" onChange={(v) => s.updateAccount(acc.id, { balance: v, lastUpdated: todayISO() })} />
                      </TD>
                      <TD>
                        {g.kind === 'taxable' ? (
                          <span className="font-mono text-[12px] text-faint">Joint</span>
                        ) : (
                          <SelectInput value={acc.owner ?? 'self'} options={ownerOpts} onChange={(v) => s.updateAccount(acc.id, { owner: v })} />
                        )}
                      </TD>
                      <TD align="right"><span className="font-mono text-[11px] text-muted">{acc.lastUpdated ? fmtDate(acc.lastUpdated) : '—'}</span></TD>
                      <DeleteCell onClick={() => s.removeAccount(acc.id)} />
                    </TR>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <TD className="text-faint"><span className="text-[12px]">None yet</span></TD>
                      <TD /><TD /><TD />
                      <td />
                    </tr>
                  )}
                </tbody>
                <AddRow colSpan={4} onClick={() => s.addAccount(g.kind)} label={`Add ${g.kind === 'pretax' ? 'pre-tax' : g.kind} account`} />
              </Grid>
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-lg bg-primary-tint px-4 py-3">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-primary">Total current assets</span>
          <span className="font-head text-[20px] font-bold text-ink tabnum">{fmtUSD(total)}</span>
        </div>
        <p className="-mt-3 text-[11px] text-faint">
          Editing an amount stamps today as its “Updated” date. Total shown: {fmtUSDAbbrev(total)}.
        </p>
      </div>
    </Section>
  );
}
