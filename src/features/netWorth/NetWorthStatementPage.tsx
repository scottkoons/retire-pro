import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Button } from '@/components/ui/primitives';
import { StatTile, BarRow } from '@/components/ui/tiles';
import { Grid, THead, TR, TD, DeleteCell, AddRow, TotalRow, TextInput, NumberInput, SelectInput, useSort } from '@/components/grid/Grid';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev, fmtDate, todayISO } from '@/lib/format';
import type { NetWorthCategory } from '@/domain/types';

// Display metadata per category (labels for selects, colors for the breakdown bars).
const CATEGORIES: { value: NetWorthCategory; label: string; color: string }[] = [
  { value: 'realEstate', label: 'Real Estate', color: chart.cat[1] },
  { value: 'vehicles', label: 'Vehicles', color: chart.cat[2] },
  { value: 'cash', label: 'Cash & Bank', color: chart.cat[3] },
  { value: 'education', label: 'Education (529s)', color: chart.cat[4] },
  { value: 'business', label: 'Business & Unrealized Equity', color: chart.cat[5] },
  { value: 'other', label: 'Other', color: chart.cat[6] },
];
const catLabel = (c: NetWorthCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/**
 * Household balance sheet: everything owned minus everything owed, valued
 * today. Deliberately outside the scenario system and the projection engine.
 * The Investments line mirrors the active scenario's enabled accounts so the
 * retirement portfolio never has to be retyped here.
 */
export default function NetWorthStatementPage() {
  const navigate = useNavigate();
  const scn = useActiveScenario();
  const nw = useStore((s) => s.netWorth) ?? { items: [], snapshots: [] };
  const addItem = useStore((s) => s.addNetWorthItem);
  const updateItem = useStore((s) => s.updateNetWorthItem);
  const removeItem = useStore((s) => s.removeNetWorthItem);
  const saveSnapshot = useStore((s) => s.saveNetWorthSnapshot);

  const investments = scn.accounts.filter((x) => x.enabled).reduce((sum, x) => sum + x.balance, 0);
  const assetsItems = nw.items.filter((i) => !i.liability);
  const debtItems = nw.items.filter((i) => i.liability);

  const manualAssets = assetsItems.reduce((s, i) => s + i.value, 0);
  const totalAssets = investments + manualAssets;
  const totalDebts = debtItems.reduce((s, i) => s + i.value, 0);
  const netWorth = totalAssets - totalDebts;

  // Category breakdown for the bars (Investments shown as its own slice).
  const breakdown = useMemo(() => {
    const rows = [{ label: 'Investments', value: investments, color: chart.primary }];
    for (const c of CATEGORIES) {
      const v = assetsItems.filter((i) => i.category === c.value).reduce((s, i) => s + i.value, 0);
      if (v > 0) rows.push({ label: c.label, value: v, color: c.color });
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [assetsItems, investments]);
  const maxSlice = Math.max(1, ...breakdown.map((b) => b.value));

  const assetSort = useSort(
    assetsItems,
    {
      name: (i) => i.name.toLowerCase(),
      category: (i) => catLabel(i.category).toLowerCase(),
      value: (i) => i.value,
      updated: (i) => i.lastUpdated ?? '',
    },
    { key: 'value', dir: 'desc' },
  );
  const debtSort = useSort(
    debtItems,
    {
      name: (i) => i.name.toLowerCase(),
      value: (i) => i.value,
      updated: (i) => i.lastUpdated ?? '',
    },
    { key: 'value', dir: 'desc' },
  );

  const takeSnapshot = () =>
    saveSnapshot({ date: todayISO(), assets: totalAssets, liabilities: totalDebts, netWorth });

  const catOpts = CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-head-lg text-ink">Net Worth</h1>
          <p className="mt-1 text-[13px] text-muted">
            Everything you own minus everything you owe, valued today. Separate from the retirement projection.
          </p>
        </div>
        <Button variant="outline" onClick={takeSnapshot}>Save snapshot</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Assets" value={fmtUSD(totalAssets)} sub={`incl. ${fmtUSD(investments)} investments`} tint="green" />
        <StatTile label="Total Liabilities" value={fmtUSD(totalDebts)} tint="amber" />
        <StatTile label="Net Worth" value={fmtUSD(netWorth)} accent={netWorth >= 0 ? 'primary' : 'error'} tint="blue" />
      </div>

      {/* Where the assets sit */}
      {breakdown.length > 0 && totalAssets > 0 && (
        <Section title="Asset Mix" subtitle="Share of total assets by category">
          <div className="flex flex-col gap-1">
            {breakdown.map((b) => (
              <BarRow
                key={b.label}
                label={b.label}
                value={<>{fmtUSD(b.value)} <span className="ml-1 text-[12px] font-normal text-muted">{Math.round((b.value / Math.max(1, totalAssets)) * 100)}%</span></>}
                fraction={b.value / maxSlice}
                color={b.color}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Investments mirror line */}
      <Section title="Investments" subtitle="Mirrors your retirement accounts; edit balances in Settings, Accounts & Assets">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex w-full items-center justify-between rounded-lg border border-border-strong bg-input px-4 py-3 text-left transition-colors hover:border-primary"
        >
          <span className="text-[14px] text-ink">{scn.accounts.filter((x) => x.enabled).length} accounts (401k, Roth, brokerage, ...)</span>
          <span className="text-[16px] font-semibold text-ink tabnum">{fmtUSD(investments)}</span>
        </button>
      </Section>

      {/* Manual assets */}
      <Section title="Other Assets" subtitle="House, cars, bank accounts, 529s, unrealized equity — anything you own">
        <Grid minWidth={720}>
          <THead
            sort={assetSort.sort}
            onSort={assetSort.onSort}
            cols={[
              { label: 'Asset', w: '30%', sortKey: 'name' },
              { label: 'Category', w: '26%', sortKey: 'category' },
              { label: 'Value', align: 'right', sortKey: 'value' },
              { label: 'Updated', align: 'right', sortKey: 'updated' },
            ]}
          />
          <tbody>
            {assetSort.sorted.map((i) => (
              <TR key={i.id}>
                <TD><TextInput value={i.name} onChange={(v) => updateItem(i.id, { name: v })} /></TD>
                <TD><SelectInput value={i.category} options={catOpts} onChange={(v) => updateItem(i.id, { category: v })} /></TD>
                <TD align="right"><NumberInput value={i.value} prefix="$" onChange={(v) => updateItem(i.id, { value: v })} /></TD>
                <TD align="right"><span className="text-[12px] text-faint tabnum">{i.lastUpdated ? fmtDate(i.lastUpdated) : '—'}</span></TD>
                <DeleteCell onClick={() => removeItem(i.id)} />
              </TR>
            ))}
            {assetsItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-muted">
                  Nothing here yet — add your house, vehicles, bank accounts, 529s, and unrealized stock.
                </td>
              </tr>
            )}
          </tbody>
          <AddRow colSpan={4} onClick={() => addItem('realEstate')} label="Add asset" />
          {assetsItems.length > 0 && (
            <tbody>
              <TotalRow>
                <TD>Total other assets</TD>
                <TD />
                <TD align="right"><span className="font-mono text-ink tabnum">{fmtUSD(manualAssets)}</span></TD>
                <TD />
                <td />
              </TotalRow>
            </tbody>
          )}
        </Grid>
      </Section>

      {/* Liabilities */}
      <Section title="Liabilities" subtitle="Mortgage balance, car loans, anything owed">
        <Grid minWidth={620}>
          <THead
            sort={debtSort.sort}
            onSort={debtSort.onSort}
            cols={[
              { label: 'Debt', w: '44%', sortKey: 'name' },
              { label: 'Balance owed', align: 'right', sortKey: 'value' },
              { label: 'Updated', align: 'right', sortKey: 'updated' },
            ]}
          />
          <tbody>
            {debtSort.sorted.map((i) => (
              <TR key={i.id}>
                <TD><TextInput value={i.name} onChange={(v) => updateItem(i.id, { name: v })} /></TD>
                <TD align="right"><NumberInput value={i.value} prefix="$" onChange={(v) => updateItem(i.id, { value: v })} /></TD>
                <TD align="right"><span className="text-[12px] text-faint tabnum">{i.lastUpdated ? fmtDate(i.lastUpdated) : '—'}</span></TD>
                <DeleteCell onClick={() => removeItem(i.id)} />
              </TR>
            ))}
            {debtItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-muted">No debts entered — add the mortgage and any loans.</td>
              </tr>
            )}
          </tbody>
          <AddRow colSpan={3} onClick={() => addItem('other', true)} label="Add debt" />
          {debtItems.length > 0 && (
            <tbody>
              <TotalRow>
                <TD>Total liabilities</TD>
                <TD align="right"><span className="font-mono text-ink tabnum">{fmtUSD(totalDebts)}</span></TD>
                <TD />
                <td />
              </TotalRow>
            </tbody>
          )}
        </Grid>
      </Section>

      {/* Trend from snapshots */}
      <Section
        title="Net Worth Over Time"
        subtitle={nw.snapshots.length < 2 ? 'Save a snapshot whenever you update values; the trend appears once you have two or more' : `${nw.snapshots.length} snapshots`}
      >
        {nw.snapshots.length >= 2 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={nw.snapshots} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="date" stroke={chart.axis} tickLine={false} tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }} tickFormatter={(d: string) => fmtDate(d)} />
              <YAxis stroke={chart.axis} tickLine={false} axisLine={false} width={56} tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }} tickFormatter={(v: number) => fmtUSDAbbrev(v)} />
              <Tooltip
                contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                labelFormatter={(d) => fmtDate(String(d))}
                formatter={(v: number, name: string) => [fmtUSD(v), name === 'netWorth' ? 'Net worth' : name === 'assets' ? 'Assets' : 'Liabilities']}
              />
              <Line type="monotone" dataKey="assets" stroke={chart.success} strokeWidth={1.4} dot={false} />
              <Line type="monotone" dataKey="netWorth" stroke={chart.primary} strokeWidth={2.2} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-4 text-center text-[13px] text-muted">
            Current: <span className="font-semibold text-ink tabnum">{fmtUSD(netWorth)}</span> · press "Save snapshot" above to start the history.
          </p>
        )}
      </Section>
    </div>
  );
}
