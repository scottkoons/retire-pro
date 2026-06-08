import { useActiveScenario, useStore } from '@/state/store';
import { Section, Segmented } from '@/components/ui/primitives';

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
          <input
            type="number"
            className={fieldCls}
            value={home.currentValue}
            onChange={(e) => s.updateHome({ currentValue: Number(e.target.value) })}
          />
        </Field>

        <Field label="Mortgage balance">
          <input
            type="number"
            className={fieldCls}
            value={home.mortgageBalance}
            onChange={(e) => s.updateHome({ mortgageBalance: Number(e.target.value) })}
          />
        </Field>

        <Field label="Home growth %">
          <input
            type="number"
            step={0.1}
            className={fieldCls}
            value={+(home.growthRate * 100).toFixed(2)}
            onChange={(e) => s.updateHome({ growthRate: Number(e.target.value) / 100 })}
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
            onChange={(e) => s.updateHome({ sellingCostPct: Number(e.target.value) / 100 })}
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
            onChange={(e) => s.updateHome({ purchaseAge: Number(e.target.value) })}
          />
        </Field>

        <Field label="Purchase price">
          <input
            type="number"
            className={fieldCls}
            value={home.price}
            onChange={(e) => s.updateHome({ price: Number(e.target.value) })}
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
          <input
            type="number"
            className={fieldCls}
            value={home.downPayment}
            onChange={(e) => s.updateHome({ downPayment: Number(e.target.value) })}
          />
        </Field>

        <Field label="Loan rate %">
          <input
            type="number"
            step={0.1}
            className={fieldCls}
            value={+(home.loanRate * 100).toFixed(2)}
            onChange={(e) => s.updateHome({ loanRate: Number(e.target.value) / 100 })}
          />
        </Field>

        <Field label="Term years">
          <input
            type="number"
            className={fieldCls}
            value={home.termYears}
            onChange={(e) => s.updateHome({ termYears: Number(e.target.value) })}
          />
        </Field>

        <Field label="HOA $/mo">
          <input
            type="number"
            className={fieldCls}
            value={home.hoaMonthly}
            onChange={(e) => s.updateHome({ hoaMonthly: Number(e.target.value) })}
          />
        </Field>

        <Field label="Property tax rate %">
          <input
            type="number"
            step={0.01}
            className={fieldCls}
            value={+(home.propertyTaxRate * 100).toFixed(2)}
            onChange={(e) => s.updateHome({ propertyTaxRate: Number(e.target.value) / 100 })}
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
          <input
            type="number"
            className={fieldCls}
            value={home.clubInitiation}
            onChange={(e) => s.updateHome({ clubInitiation: Number(e.target.value) })}
          />
        </Field>

        <Field label="Club dues $/mo">
          <input
            type="number"
            className={fieldCls}
            value={home.clubMonthly}
            onChange={(e) => s.updateHome({ clubMonthly: Number(e.target.value) })}
          />
        </Field>
      </div>
    </Section>
  );
}
