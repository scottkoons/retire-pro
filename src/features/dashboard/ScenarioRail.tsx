import { useState } from 'react';
import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { Card, Button, MoneyInput, Segmented } from '@/components/ui/primitives';
import { IconPlus, IconTrash, IconDiamond, IconRepeat, IconGift, IconChevronDown, IconChevronLeft } from '@/components/icons';
import { isoFromAge, ageFromISO, isoFromMonthValue, monthValueFromISO } from '@/lib/dates';
import { contributionOverlaps } from '@/lib/contributions';
import { fmtUSD, fmtAgeYM, fmtMonthsYM } from '@/lib/format';
import type { DollarBasis, TaxStatus } from '@/domain/types';

// Shared control chrome. Inputs are sized for comfortable reading (13px), not the
// 9–12px they were before.
const control =
  'h-9 w-full rounded-md border border-border-strong bg-input px-2.5 text-[13px] text-ink transition-colors focus:border-primary focus:outline-none';
const dateInput = clsx(control, 'font-mono tabnum [color-scheme:dark]');

// Each section gets its own colour so monthly (recurring) and lump-sum (one-time)
// money read as two distinct kinds of thing at a glance.
type Accent = {
  bar: string; // solid left accent bar / dot
  text: string; // accent text + icon colour
  chip: string; // tinted icon-chip background (rgba, applied inline)
};
const MONTHLY: Accent = { bar: 'bg-primary', text: 'text-primary', chip: 'rgba(249, 115, 22, 0.14)' };
const LUMP: Accent = { bar: 'bg-cat-1', text: 'text-cat-1', chip: 'rgba(167, 139, 250, 0.16)' };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1', className)}>
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-muted">{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({
  accent,
  icon,
  title,
  hint,
  count,
  collapsed,
  onToggle,
  onAdd,
}: {
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  hint: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="group flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <IconChevronDown className={clsx('mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-hover:text-ink', collapsed && '-rotate-90')} />
        <span
          className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', accent.text)}
          style={{ backgroundColor: accent.chip }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-none text-ink">{title}</h3>
            <span className={clsx('rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none', accent.text)} style={{ backgroundColor: accent.chip }}>
              {count}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">{hint}</p>
        </div>
      </button>
      <Button variant="ghost" size="sm" onClick={onAdd} className="shrink-0">
        <IconPlus className="h-4 w-4" /> Add
      </Button>
    </div>
  );
}

function EventCard({
  accent,
  name,
  onName,
  onDelete,
  enabled,
  onToggle,
  children,
}: {
  accent: Accent;
  name: string;
  onName: (v: string) => void;
  onDelete: () => void;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-card-high pl-4 pr-3.5 pt-3.5 pb-3">
      {/* Coloured spine identifies the row's category; greys out when deactivated. */}
      <span className={clsx('absolute inset-y-0 left-0 w-1', enabled ? accent.bar : 'bg-border-strong')} aria-hidden />
      <div className="mb-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold text-ink transition-colors hover:border-border-strong focus:border-primary focus:bg-input focus:outline-none"
        />
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          title={enabled ? 'Active — uncheck to deactivate (keeps the values)' : 'Inactive — check to include in the plan'}
          aria-label="Include in the plan"
          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <button onClick={onDelete} aria-label="Delete" className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-error-tint hover:text-error">
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
      <div className={clsx(!enabled && 'opacity-45')}>{children}</div>
    </div>
  );
}

export function ScenarioRail() {
  const scn = useActiveScenario();
  const a = scn.assumptions;
  const s = useStore();

  const [openMonthly, setOpenMonthly] = useState(true);
  const [openLumps, setOpenLumps] = useState(true);
  // Adding a row expands its section so the new card is visible.
  const addContribution = () => {
    setOpenMonthly(true);
    s.addContribution();
  };
  const addLump = () => {
    setOpenLumps(true);
    s.addLumpSum();
  };

  const basisOpts: { value: DollarBasis; label: string }[] = [
    { value: 'today', label: "Today's $" },
    { value: 'actual', label: 'Actual $' },
  ];
  const taxOpts: { value: TaxStatus; label: string }[] = [
    { value: 'taxable', label: 'Taxable' },
    { value: 'tax-free', label: 'Tax-free' },
  ];

  const totalMonthly = scn.contributions
    .filter((c) => c.enabled)
    .reduce((sum, c) => sum + Math.max(0, Math.round((c.endAge - c.startAge) * 12)) * c.monthlyAmount, 0);
  const overlaps = contributionOverlaps(scn.contributions, a);
  const totalLumps = scn.lumpSums.filter((l) => l.enabled).reduce((sum, l) => sum + l.amount, 0);

  return (
    <Card className="xl:sticky xl:top-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <div className="label-mono flex items-center gap-1.5">
            <IconDiamond className="h-3 w-3 text-primary" /> Scenario Inputs
          </div>
          <div className="mt-1 text-[16px] font-semibold leading-tight text-ink">{scn.name}</div>
        </div>
        <button
          type="button"
          onClick={() => s.toggleRail(true)}
          aria-label="Collapse scenario inputs"
          title="Collapse"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <span>Collapse</span>
          <IconChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-9rem)] space-y-7 overflow-auto px-5 py-5">
        {/* ── Monthly Contributions (recurring) ───────────────────────────── */}
        <section>
          <SectionHeader
            accent={MONTHLY}
            icon={<IconRepeat className="h-[18px] w-[18px]" />}
            title="Monthly Contributions"
            hint="Recurring deposits while you are still saving"
            count={scn.contributions.length}
            collapsed={!openMonthly}
            onToggle={() => setOpenMonthly((o) => !o)}
            onAdd={addContribution}
          />

          {openMonthly && (
          <div className="flex flex-col gap-3">
            {scn.contributions.map((c) => {
              const months = Math.max(0, Math.round((c.endAge - c.startAge) * 12));
              return (
                <EventCard key={c.id} accent={MONTHLY} name={c.name} onName={(v) => s.updateContribution(c.id, { name: v })} onDelete={() => s.removeContribution(c.id)} enabled={c.enabled} onToggle={() => s.updateContribution(c.id, { enabled: !c.enabled })}>
                  {/* Hero: the monthly amount, large and grouped. */}
                  <Field label="Contribution / month">
                    <MoneyInput
                      size="lg"
                      suffix="/mo"
                      value={c.monthlyAmount}
                      onChange={(n) => s.updateContribution(c.id, { monthlyAmount: n })}
                      ariaLabel={`${c.name} monthly amount`}
                    />
                  </Field>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Start">
                      <input
                        type="month"
                        className={dateInput}
                        value={monthValueFromISO(c.startDateOverride ?? isoFromAge(c.startAge, a))}
                        onChange={(e) => {
                          const iso = isoFromMonthValue(e.target.value);
                          if (iso) s.updateContribution(c.id, { startDateOverride: iso, startAge: ageFromISO(iso, a) });
                        }}
                      />
                    </Field>
                    <Field label="End">
                      <input
                        type="month"
                        className={dateInput}
                        value={monthValueFromISO(c.endDateOverride ?? isoFromAge(c.endAge, a))}
                        onChange={(e) => {
                          const iso = isoFromMonthValue(e.target.value);
                          if (iso) s.updateContribution(c.id, { endDateOverride: iso, endAge: ageFromISO(iso, a) });
                        }}
                      />
                    </Field>
                    <Field label="Dollar basis" className="col-span-2">
                      <Segmented size="sm" options={basisOpts} value={c.dollarBasis} onChange={(v) => s.updateContribution(c.id, { dollarBasis: v })} />
                    </Field>
                  </div>

                  {/* Footer: duration → total contributed over the window. */}
                  <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[12px]">
                    <span className="font-mono text-muted">{fmtMonthsYM(months)}</span>
                    <span className="font-mono tabnum text-[13px] font-semibold text-ink">{fmtUSD(months * c.monthlyAmount)} total</span>
                  </div>
                  {overlaps.has(c.id) && (
                    <div className="mt-2 rounded-md bg-error-tint px-2.5 py-1.5 text-[11px] font-medium text-error">
                      Overlaps “{overlaps.get(c.id)}” — those months count both amounts. Start this period in the month the other one ends.
                    </div>
                  )}
                </EventCard>
              );
            })}
            {scn.contributions.length === 0 && (
              <p className="rounded-xl border border-dashed border-border-subtle py-5 text-center text-[13px] text-faint">No contributions yet</p>
            )}
          </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-tint px-3.5 py-2.5">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-primary">Total contributed</span>
            <span className="font-mono tabnum text-[15px] font-bold text-ink">{fmtUSD(totalMonthly)}</span>
          </div>
        </section>

        {/* ── Lump Sum Events (one-time) ──────────────────────────────────── */}
        <section>
          <SectionHeader
            accent={LUMP}
            icon={<IconGift className="h-[18px] w-[18px]" />}
            title="Lump Sum Events"
            hint="One-time inflows like a home sale or windfall"
            count={scn.lumpSums.length}
            collapsed={!openLumps}
            onToggle={() => setOpenLumps((o) => !o)}
            onAdd={addLump}
          />

          {openLumps && (
          <div className="flex flex-col gap-3">
            {scn.lumpSums.map((l) => {
              const age = l.dateOverride ? ageFromISO(l.dateOverride, a) : l.age;
              return (
                <EventCard key={l.id} accent={LUMP} name={l.name} onName={(v) => s.updateLumpSum(l.id, { name: v })} onDelete={() => s.removeLumpSum(l.id)} enabled={l.enabled} onToggle={() => s.updateLumpSum(l.id, { enabled: !l.enabled })}>
                  {/* Hero: the one-time amount, large and grouped. */}
                  <Field label="One-time amount">
                    <MoneyInput
                      size="lg"
                      value={l.amount}
                      onChange={(n) => s.updateLumpSum(l.id, { amount: n })}
                      ariaLabel={`${l.name} amount`}
                    />
                  </Field>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Date" className="col-span-2">
                      <input
                        type="month"
                        className={dateInput}
                        value={monthValueFromISO(l.dateOverride ?? isoFromAge(l.age, a))}
                        onChange={(e) => {
                          const iso = isoFromMonthValue(e.target.value);
                          if (iso) s.updateLumpSum(l.id, { dateOverride: iso, age: ageFromISO(iso, a) });
                        }}
                      />
                    </Field>
                    <Field label="Dollar basis" className="col-span-2">
                      <Segmented size="sm" options={basisOpts} value={l.dollarBasis} onChange={(v) => s.updateLumpSum(l.id, { dollarBasis: v })} />
                    </Field>
                    <Field label="Tax status" className="col-span-2">
                      <Segmented size="sm" options={taxOpts} value={l.taxStatus ?? 'taxable'} onChange={(v) => s.updateLumpSum(l.id, { taxStatus: v })} />
                    </Field>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[12px]">
                    <span className="font-mono text-muted">Occurs at</span>
                    <span className="font-mono tabnum text-[13px] font-semibold text-ink">{fmtAgeYM(age)}</span>
                  </div>
                </EventCard>
              );
            })}
            {scn.lumpSums.length === 0 && (
              <p className="rounded-xl border border-dashed border-border-subtle py-5 text-center text-[13px] text-faint">No lump sum events yet</p>
            )}
          </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ backgroundColor: LUMP.chip }}>
            <span className={clsx('font-mono text-[12px] font-medium uppercase tracking-[0.06em]', LUMP.text)}>Total lump sums</span>
            <span className="font-mono tabnum text-[15px] font-bold text-ink">{fmtUSD(totalLumps)}</span>
          </div>
        </section>
      </div>
    </Card>
  );
}
