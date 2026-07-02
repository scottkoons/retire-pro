import { useActiveScenario, useStore } from '@/state/store';
import { Section, Segmented, GroupedNumberField } from '@/components/ui/primitives';
import { onNum } from '@/lib/inputs';

// Local label+input layout helper (matches the planner config-form convention).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

const fieldCls =
  'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

// Reusable yes/no boolean options for Segmented toggles.
const yesNo: { value: 'yes' | 'no'; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function HomeSection() {
  const scn = useActiveScenario();
  const s = useStore();
  const home = scn.home;

  return (
    <Section
      title="Home & Real Estate"
      subtitle="Mortgage, sale, and a planned purchase feed net worth and spending"
      actions={
        <Segmented
          options={[
            { value: 'on', label: 'Enabled' },
            { value: 'off', label: 'Off' },
          ]}
          value={home.enabled ? 'on' : 'off'}
          onChange={(v) => s.updateHome({ enabled: v === 'on' })}
        />
      }
    >
      {/* All fields dim and lock when the home plan is disabled. */}
      <div
        className={`grid grid-cols-2 gap-4 md:grid-cols-3 ${
          home.enabled ? '' : 'opacity-50 pointer-events-none'
        }`}
      >
        {/* Current residence */}
        <Field label="Current value">
          <GroupedNumberField
            className={fieldCls}
            value={home.currentValue}
            onChange={(n) => s.updateHome({ currentValue: n })}
          />
        </Field>

        <Field label="Mortgage balance">
          <GroupedNumberField
            className={fieldCls}
            value={home.mortgageBalance}
            onChange={(n) => s.updateHome({ mortgageBalance: n })}
          />
        </Field>

        <Field label="Home growth %">
          <input
            type="number"
            step={0.1}
            className={fieldCls}
            value={+(home.growthRate * 100).toFixed(2)}
            onChange={onNum((n) => s.updateHome({ growthRate: n }), 100)}
          />
        </Field>

        <Field label="Sell current home">
          <Segmented
            options={yesNo}
            value={home.sellCurrent ? 'yes' : 'no'}
            onChange={(v) => s.updateHome({ sellCurrent: v === 'yes' })}
          />
        </Field>

        <Field label="Selling cost %">
          <input
            type="number"
            step={0.1}
            className={fieldCls}
            value={+(home.sellingCostPct * 100).toFixed(2)}
            onChange={onNum((n) => s.updateHome({ sellingCostPct: n }), 100)}
          />
        </Field>

        {/* Planned purchase */}
        <Field label="Planned purchase">
          <Segmented
            options={yesNo}
            value={home.plannedPurchase ? 'yes' : 'no'}
            onChange={(v) => s.updateHome({ plannedPurchase: v === 'yes' })}
          />
        </Field>

        <Field label="Purchase age">
          <input
            type="number"
            className={fieldCls}
            value={home.purchaseAge}
            onChange={onNum((n) => s.updateHome({ purchaseAge: n }))}
          />
        </Field>

        <Field label="Purchase price">
          <GroupedNumberField
            className={fieldCls}
            value={home.price}
            onChange={(n) => s.updateHome({ price: n })}
          />
        </Field>

        <Field label="Financed">
          <Segmented
            options={yesNo}
            value={home.financed ? 'yes' : 'no'}
            onChange={(v) => s.updateHome({ financed: v === 'yes' })}
          />
        </Field>

        <Field label="Down payment">
          <GroupedNumberField
            className={fieldCls}
            value={home.downPayment}
            onChange={(n) => s.updateHome({ downPayment: n })}
          />
        </Field>

        <Field label="Loan rate %">
          <input
            type="number"
            step={0.1}
            className={fieldCls}
            value={+(home.loanRate * 100).toFixed(2)}
            onChange={onNum((n) => s.updateHome({ loanRate: n }), 100)}
          />
        </Field>

        <Field label="Term years">
          <input
            type="number"
            className={fieldCls}
            value={home.termYears}
            onChange={onNum((n) => s.updateHome({ termYears: n }))}
          />
        </Field>

        <Field label="HOA $/mo">
          <GroupedNumberField
            className={fieldCls}
            value={home.hoaMonthly}
            onChange={(n) => s.updateHome({ hoaMonthly: n })}
          />
        </Field>

        <Field label="Property tax rate %">
          <input
            type="number"
            step={0.01}
            className={fieldCls}
            value={+(home.propertyTaxRate * 100).toFixed(2)}
            onChange={onNum((n) => s.updateHome({ propertyTaxRate: n }), 100)}
          />
        </Field>

        <Field label="Disabled-vet exemption">
          <Segmented
            options={yesNo}
            value={home.disabledVetExemption ? 'yes' : 'no'}
            onChange={(v) => s.updateHome({ disabledVetExemption: v === 'yes' })}
          />
        </Field>

        {/* Club */}
        <Field label="Club initiation">
          <GroupedNumberField
            className={fieldCls}
            value={home.clubInitiation}
            onChange={(n) => s.updateHome({ clubInitiation: n })}
          />
        </Field>

        <Field label="Club dues $/mo">
          <GroupedNumberField
            className={fieldCls}
            value={home.clubMonthly}
            onChange={(n) => s.updateHome({ clubMonthly: n })}
          />
        </Field>
      </div>
    </Section>
  );
}
