import { useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import { Grid, THead, TR, TD, TextInput, NumberInput, SelectInput, DeleteCell, AddRow, type SortState } from '@/components/grid/Grid';
import { fmtUSD, fmtUSDAbbrev, fmtDate, todayISO } from '@/lib/format';
import type { Account, AccountKind, Owner } from '@/domain/types';

// One shared sort drives all three account groups.
const sortAccounts = (rows: Account[], sort: SortState): Account[] => {
  const arr = [...rows];
  arr.sort((a, b) => {
    let x: number | string;
    let y: number | string;
    if (sort.key === 'balance') {
      x = a.balance;
      y = b.balance;
    } else if (sort.key === 'owner') {
      x = (a.owner ?? 'self').toLowerCase();
      y = (b.owner ?? 'self').toLowerCase();
    } else {
      x = a.name.toLowerCase();
      y = b.name.toLowerCase();
    }
    if (x < y) return sort.dir === 'asc' ? -1 : 1;
    if (x > y) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  return arr;
};

const GROUPS: { kind: AccountKind; label: string; help: string }[] = [
  { kind: 'pretax', label: 'Pre-tax (401k, Traditional IRA)', help: 'Taxed as income when withdrawn' },
  { kind: 'roth', label: 'Tax-free (Roth IRA, Roth 401k)', help: 'Never taxed on withdrawal; no RMDs' },
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

  // Shared sort for all three groups; default to balance descending.
  const [sort, setSort] = useState<SortState>({ key: 'balance', dir: 'desc' });
  const onSort = (key: string) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <Section title="Accounts & Assets" subtitle="Your current balances by tax type; the total feeds the Dashboard and Net Worth">
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => {
          const list = accounts.filter((a) => a.kind === g.kind);
          const subtotal = list.filter((a) => a.enabled).reduce((sum, a) => sum + a.balance, 0);
          const sortedList = sortAccounts(list, sort);
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
                  sort={sort}
                  onSort={onSort}
                  cols={[
                    { label: 'Account', w: '34%', sortKey: 'name' },
                    { label: 'Amount', align: 'right', sortKey: 'balance' },
                    { label: 'Owner', sortKey: 'owner' },
                    { label: 'Updated', align: 'right' },
                  ]}
                />
                <tbody>
                  {sortedList.map((acc) => (
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
                {g.kind === 'roth' ? (
                  <AddRow
                    colSpan={4}
                    onClick={() => s.addAccount('roth', 'Roth IRA')}
                    label="Add Roth IRA"
                    extra={{ label: 'Add Roth 401(k)', onClick: () => s.addAccount('roth', 'Roth 401(k)') }}
                  />
                ) : (
                  <AddRow colSpan={4} onClick={() => s.addAccount(g.kind)} label={`Add ${g.kind === 'pretax' ? 'pre-tax' : g.kind} account`} />
                )}
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
          These balances are your starting point; monthly savings are entered on the Planner as
          Monthly Contributions and grow the pooled portfolio going forward.
        </p>
      </div>
    </Section>
  );
}
