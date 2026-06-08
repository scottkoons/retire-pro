import { useActiveScenario, useStore } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import {
  Grid,
  THead,
  TR,
  TD,
  TotalRow,
  DeleteCell,
  AddRow,
  TextInput,
  NumberInput,
  SelectInput,
  useSort,
} from '@/components/grid/Grid';
import { IconDiamond } from '@/components/icons';
import { fmtUSD } from '@/lib/format';
import type { AccountKind } from '@/domain/types';

const kindOpts: { value: AccountKind; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'pretax', label: 'Pre-tax' },
  { value: 'roth', label: 'Roth' },
];

const ownerOpts: { value: 'self' | 'spouse'; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
];

// Display labels for each account kind, used by both the grid and the order chips.
const KIND_LABEL: Record<AccountKind, string> = {
  taxable: 'Taxable',
  pretax: 'Pre-tax',
  roth: 'Roth',
};

export function AccountsSection() {
  const scn = useActiveScenario();
  const s = useStore();

  // Total balance across enabled accounts; mirrors the Dashboard's starting amount.
  const total = scn.accounts.filter((a) => a.enabled).reduce((sum, a) => sum + a.balance, 0);

  // Swap the chip at `i` with its neighbor at `i + dir`, then commit the new sequence.
  const moveSeq = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= scn.withdrawalSequence.length) return;
    const next = [...scn.withdrawalSequence];
    [next[i], next[j]] = [next[j], next[i]];
    s.reorderWithdrawalSequence(next);
  };

  // Column-header sorting for the accounts grid. Default: Balance, descending.
  const { sorted, sort, onSort } = useSort(
    scn.accounts,
    {
      name: (a) => a.name.toLowerCase(),
      kind: (a) => KIND_LABEL[a.kind].toLowerCase(),
      balance: (a) => a.balance,
      costBasis: (a) => (a.kind === 'taxable' ? (a.costBasisRatio ?? 0.5) : -1),
      owner: (a) => (a.kind === 'taxable' ? 'joint' : (a.owner ?? 'self')),
      returnOverride: (a) => a.returnOverride ?? -Infinity,
    },
    { key: 'balance', dir: 'desc' },
  );

  return (
    <Section title="Accounts" subtitle="Balances drive the tax-aware projection">
      <Grid minWidth={860}>
        <THead
          sort={sort}
          onSort={onSort}
          cols={[
            { label: 'Account', w: '22%', sortKey: 'name' },
            { label: 'Type', sortKey: 'kind' },
            { label: 'Balance', align: 'right', sortKey: 'balance' },
            { label: 'Cost Basis %', align: 'right', sortKey: 'costBasis' },
            { label: 'Owner', sortKey: 'owner' },
            { label: 'Return Ovr', align: 'right', sortKey: 'returnOverride' },
            { label: 'Contrib Target', align: 'center' },
          ]}
        />
        <tbody>
          {sorted.map((acc) => (
            <TR key={acc.id} dim={!acc.enabled}>
              <TD>
                <TextInput value={acc.name} onChange={(v) => s.updateAccount(acc.id, { name: v })} />
              </TD>
              <TD>
                <SelectInput value={acc.kind} options={kindOpts} onChange={(v) => s.updateAccount(acc.id, { kind: v })} />
              </TD>
              <TD align="right">
                <NumberInput value={acc.balance} prefix="$" onChange={(v) => s.updateAccount(acc.id, { balance: v })} />
              </TD>
              <TD align="right">
                {acc.kind === 'taxable' ? (
                  <NumberInput
                    value={+(((acc.costBasisRatio ?? 0.5) * 100).toFixed(0))}
                    suffix="%"
                    onChange={(v) => s.updateAccount(acc.id, { costBasisRatio: Math.max(0, Math.min(1, v / 100)) })}
                  />
                ) : (
                  <span className="font-mono text-faint">—</span>
                )}
              </TD>
              <TD>
                {acc.kind === 'taxable' ? (
                  <span className="font-mono text-faint">Joint</span>
                ) : (
                  <SelectInput
                    value={acc.owner ?? 'self'}
                    options={ownerOpts}
                    onChange={(v) => s.updateAccount(acc.id, { owner: v })}
                  />
                )}
              </TD>
              <TD align="right">
                <NumberInput
                  value={acc.returnOverride != null ? +(acc.returnOverride * 100).toFixed(1) : 0}
                  suffix="%"
                  onChange={(v) => s.updateAccount(acc.id, { returnOverride: v ? v / 100 : undefined })}
                />
              </TD>
              <TD align="center">
                <button
                  onClick={() => s.setContributionTarget(acc.id)}
                  aria-label="Set as contribution target"
                  aria-pressed={!!acc.contributionTarget}
                  className={
                    acc.contributionTarget
                      ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-tint text-primary'
                      : 'inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-muted'
                  }
                >
                  <IconDiamond className="h-3.5 w-3.5" />
                </button>
              </TD>
              <DeleteCell onClick={() => s.removeAccount(acc.id)} />
            </TR>
          ))}
          <TotalRow>
            <TD><span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">Total</span></TD>
            <TD />
            <TD align="right"><span className="font-mono tabnum text-ink">{fmtUSD(total)}</span></TD>
            <TD />
            <TD />
            <TD />
            <TD />
            <td />
          </TotalRow>
        </tbody>
        <AddRow colSpan={7} onClick={() => s.addAccount()} />
      </Grid>

      {/* Withdrawal order: drained top-to-bottom; reorder with the arrows. */}
      <div className="mt-5">
        <div className="label-mono mb-2">Withdrawal order</div>
        <div className="flex flex-wrap items-center gap-2">
          {scn.withdrawalSequence.map((kind, i) => (
            <div
              key={kind}
              className="flex items-center gap-2 rounded-full border border-border-strong bg-input py-1 pl-3 pr-1.5"
            >
              <span className="font-mono text-[11px] text-faint tabnum">{i + 1}</span>
              <span className="text-[13px] font-medium text-ink">{KIND_LABEL[kind]}</span>
              <div className="flex flex-col">
                <button
                  onClick={() => moveSeq(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${KIND_LABEL[kind]} earlier`}
                  className="leading-none text-faint hover:text-ink disabled:opacity-30 disabled:hover:text-faint"
                >
                  <span className="text-[9px]">▲</span>
                </button>
                <button
                  onClick={() => moveSeq(i, 1)}
                  disabled={i === scn.withdrawalSequence.length - 1}
                  aria-label={`Move ${KIND_LABEL[kind]} later`}
                  className="leading-none text-faint hover:text-ink disabled:opacity-30 disabled:hover:text-faint"
                >
                  <span className="text-[9px]">▼</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
