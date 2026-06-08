import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Segmented } from '@/components/ui/primitives';
import {
  Grid,
  THead,
  TR,
  TD,
  DeleteCell,
  AddRow,
  TextInput,
  NumberInput,
  SelectInput,
} from '@/components/grid/Grid';
import type { ExpenseCategory, DollarBasis, SpendingMode } from '@/domain/types';

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'living', label: 'Living' },
  { value: 'travel', label: 'Travel' },
  { value: 'housing', label: 'Housing' },
  { value: 'club', label: 'Club' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'longTermCare', label: 'Long-term care' },
  { value: 'other', label: 'Other' },
];

const BASIS_OPTIONS: { value: DollarBasis; label: string }[] = [
  { value: 'today', label: "Today's $" },
  { value: 'actual', label: 'Actual $' },
];

export function ExpensesSection() {
  const scn = useActiveScenario();
  const s = useStore();

  const isPhaseTarget = scn.spendingMode === 'phase-target';

  return (
    <Section
      title="Expenses & Spending"
      subtitle="Itemize annual expenses or let a retirement-phase target drive your spending."
      actions={
        <Segmented<SpendingMode>
          options={[
            { value: 'expense-driven', label: 'Itemized' },
            { value: 'phase-target', label: 'Phase target' },
          ]}
          value={scn.spendingMode}
          onChange={(v) => s.setSpendingMode(v)}
        />
      }
    >
      {/* Mode hint: explain which input actually drives spending in the model. */}
      <p className="mb-4 text-[13px] text-muted">
        {isPhaseTarget ? (
          <>
            Retirement-phase target income drives spending while in this mode. Edit phase targets on
            the Phases page. The itemized expenses below are ignored, but stay editable so you can
            prepare them before switching modes.
          </>
        ) : (
          <>
            The itemized expense list below drives your spending each year. Each line inflates from
            its start age until its end age.
          </>
        )}
      </p>

      {/* Always render the grid; dim it when phase-target so it reads as inactive. */}
      <div className={clsx(isPhaseTarget && 'opacity-60')}>
        <Grid minWidth={820}>
          <THead
            cols={[
              { label: 'Expense', w: '24%' },
              { label: 'Category' },
              { label: 'Annual $', align: 'right' },
              { label: 'Basis' },
              { label: 'Start Age', align: 'right' },
              { label: 'End Age', align: 'right' },
              { label: 'Infl Ovr', align: 'right' },
            ]}
          />
          <tbody>
            {scn.expenses.map((e) => (
              <TR key={e.id} dim={!e.enabled}>
                <TD>
                  <TextInput value={e.name} onChange={(v) => s.updateExpense(e.id, { name: v })} />
                </TD>
                <TD>
                  <SelectInput
                    value={e.category}
                    options={CATEGORY_OPTIONS}
                    onChange={(v) => s.updateExpense(e.id, { category: v })}
                  />
                </TD>
                <TD align="right">
                  <NumberInput
                    value={e.amount}
                    prefix="$"
                    onChange={(v) => s.updateExpense(e.id, { amount: v })}
                  />
                </TD>
                <TD>
                  <SelectInput
                    value={e.dollarBasis}
                    options={BASIS_OPTIONS}
                    onChange={(v) => s.updateExpense(e.id, { dollarBasis: v })}
                  />
                </TD>
                <TD align="right">
                  <NumberInput
                    value={e.startAge}
                    onChange={(v) => s.updateExpense(e.id, { startAge: v })}
                  />
                </TD>
                <TD align="right">
                  <NumberInput
                    value={e.endAge}
                    onChange={(v) => s.updateExpense(e.id, { endAge: v })}
                  />
                </TD>
                <TD align="right">
                  <NumberInput
                    // Store inflation override as a fraction; show/edit as a percent.
                    value={e.inflationRate != null ? +(e.inflationRate * 100).toFixed(1) : 0}
                    suffix="%"
                    onChange={(v) =>
                      s.updateExpense(e.id, { inflationRate: v ? v / 100 : undefined })
                    }
                  />
                </TD>
                <DeleteCell onClick={() => s.removeExpense(e.id)} />
              </TR>
            ))}
          </tbody>
          <AddRow colSpan={7} onClick={() => s.addExpense()} label="Add expense" />
        </Grid>
      </div>
    </Section>
  );
}
