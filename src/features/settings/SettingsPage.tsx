import { useRef, useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Button, Segmented } from '@/components/ui/primitives';
import { IconTrash } from '@/components/icons';
import { exportBackup, parseBackup } from '@/persistence/storage';
import { seedDocument } from '@/domain/seed';
import type { PersistedDocument } from '@/domain/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setTheme = useStore((s) => s.setTheme);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const scn = useActiveScenario();
  const scenarios = useStore((s) => s.scenarios);
  const activeId = useStore((s) => s.activeScenarioId);
  const selectScenario = useStore((s) => s.selectScenario);
  const renameScenario = useStore((s) => s.renameScenario);
  const deleteScenario = useStore((s) => s.deleteScenario);
  const duplicateActive = useStore((s) => s.duplicateActive);
  const createFromPreset = useStore((s) => s.createFromPreset);
  const createBlank = useStore((s) => s.createBlank);
  const setAssumption = useStore((s) => s.setAssumption);
  const updateHealthcare = useStore((s) => s.updateHealthcare);
  const updateSocialSecurity = useStore((s) => s.updateSocialSecurity);
  const updateSsClaim = useStore((s) => s.updateSsClaim);
  const updateLongTermCare = useStore((s) => s.updateLongTermCare);
  const docFor = useStore;
  const hc = scn.healthcare;
  const ltc = scn.longTermCare;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fieldCls = 'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

  const doExport = () => {
    const st = docFor.getState();
    const doc: PersistedDocument = {
      schemaVersion: st.schemaVersion,
      appVersion: st.appVersion,
      savedAt: st.savedAt,
      scenarios: st.scenarios,
      activeScenarioId: st.activeScenarioId,
      settings: st.settings,
    };
    exportBackup(doc);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = parseBackup(text);
    if (res.ok) {
      replaceDocument(res.doc);
      setMsg('Backup imported successfully.');
    } else {
      setMsg(`Import failed: ${res.error}`);
    }
    e.target.value = '';
  };

  const onReset = () => {
    if (!confirm('Replace everything with the demo plan? Export a backup first if you want to keep your current plan.')) return;
    replaceDocument(seedDocument().doc);
    setMsg('Demo data restored.');
  };

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <h1 className="font-head text-head-lg text-ink">Settings</h1>

      <Section title="Scenarios" subtitle="Rename, switch, duplicate, or delete your saved plans">
        <div className="flex flex-col gap-2">
          {scenarios.map((sc) => (
            <div key={sc.id} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-card-high px-3 py-2">
              <button
                onClick={() => selectScenario(sc.id)}
                title={sc.id === activeId ? 'Active scenario' : 'Make active'}
                aria-label={sc.id === activeId ? 'Active scenario' : 'Make active'}
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${sc.id === activeId ? 'bg-primary' : 'bg-border-strong hover:bg-muted'}`}
              />
              <input
                key={`${sc.id}:${sc.name}`}
                defaultValue={sc.name}
                onBlur={(e) => renameScenario(sc.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] text-ink hover:border-border-strong focus:border-primary focus:bg-input focus:outline-none"
              />
              {sc.presetKey && <span className="shrink-0 rounded-full bg-input px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">{sc.presetKey}</span>}
              {sc.id !== activeId && (
                <Button variant="ghost" size="sm" onClick={() => selectScenario(sc.id)}>
                  Open
                </Button>
              )}
              <button
                disabled={scenarios.length <= 1}
                title={scenarios.length <= 1 ? 'Keep at least one scenario' : 'Delete this scenario'}
                aria-label={`Delete scenario ${sc.name}`}
                onClick={() => {
                  if (scenarios.length > 1 && confirm(`Delete scenario "${sc.name}"? This cannot be undone.`)) deleteScenario(sc.id);
                }}
                className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-error-tint hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-faint"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label-mono mr-1">Create:</span>
          <Button variant="outline" size="sm" onClick={createBlank}>
            Blank scenario
          </Button>
          <Button variant="outline" size="sm" onClick={duplicateActive}>
            Duplicate active
          </Button>
          {(['conservative', 'moderate', 'aggressive'] as const).map((k) => (
            <Button key={k} variant="outline" size="sm" onClick={() => createFromPreset(k)} className="capitalize">
              {k} preset
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Active Scenario" subtitle={scn.name}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Current Age">
            <input type="number" className={fieldCls} value={scn.assumptions.currentAge} onChange={(e) => setAssumption('currentAge', Number(e.target.value))} />
          </Field>
          <Field label="Model End Age">
            <input type="number" className={fieldCls} value={scn.assumptions.modelEndAge} onChange={(e) => setAssumption('modelEndAge', Number(e.target.value))} />
          </Field>
          <Field label="Inflation %">
            <input type="number" step={0.1} className={fieldCls} value={+(scn.assumptions.inflation * 100).toFixed(2)} onChange={(e) => setAssumption('inflation', Number(e.target.value) / 100)} />
          </Field>
        </div>
      </Section>

      <Section title="Monte Carlo">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Simulation Count">
            <input
              type="number"
              step={100}
              min={200}
              max={10000}
              className={fieldCls}
              value={settings.monteCarlo.simulations}
              onChange={(e) => updateSettings({ monteCarlo: { ...settings.monteCarlo, simulations: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Return Volatility %">
            <input
              type="number"
              step={0.5}
              className={fieldCls}
              value={+(settings.monteCarlo.returnVolatility * 100).toFixed(1)}
              onChange={(e) => updateSettings({ monteCarlo: { ...settings.monteCarlo, returnVolatility: Number(e.target.value) / 100 } })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Defaults & Appearance">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Default Model End Age">
            <input type="number" className={fieldCls} value={settings.defaultModelEndAge} onChange={(e) => updateSettings({ defaultModelEndAge: Number(e.target.value) })} />
          </Field>
          <Field label="Household Label">
            <input type="text" className={fieldCls} value={settings.household} onChange={(e) => updateSettings({ household: e.target.value })} />
          </Field>
          <Field label="Theme">
            <Segmented
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              value={settings.theme}
              onChange={(v) => setTheme(v)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Tax & RMD" subtitle="Drives the tax-aware projection">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="RMD Start Age">
            <input type="number" className={fieldCls} value={settings.rmdStartAge} onChange={(e) => updateSettings({ rmdStartAge: Number(e.target.value) })} />
          </Field>
          <Field label="Default Cost Basis %">
            <input
              type="number"
              step={5}
              className={fieldCls}
              value={+((settings.defaultCostBasisRatio ?? 0.5) * 100).toFixed(0)}
              onChange={(e) => updateSettings({ defaultCostBasisRatio: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
            />
          </Field>
          <Field label="Withdrawal Order">
            <div className={`${fieldCls} text-muted`}>{settings.defaultWithdrawalSequence.join(' → ')}</div>
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-faint">Per-scenario withdrawal order is edited in the Planner Sheet under Accounts.</p>
      </Section>

      <Section title="Healthcare & Medicare" subtitle={`Active scenario: ${scn.name}`}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Model Healthcare">
            <Segmented options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} value={hc.enabled ? 'on' : 'off'} onChange={(v) => updateHealthcare({ enabled: v === 'on' })} />
          </Field>
          <Field label="Part B $/mo (per person)">
            <input type="number" className={fieldCls} value={hc.medicarePartBMonthly} onChange={(e) => updateHealthcare({ medicarePartBMonthly: Number(e.target.value) })} />
          </Field>
          <Field label="Medical Inflation %">
            <input type="number" step={0.1} className={fieldCls} value={+(hc.medicalInflation * 100).toFixed(1)} onChange={(e) => updateHealthcare({ medicalInflation: Number(e.target.value) / 100 })} />
          </Field>
          <Field label="Medicare Start Age">
            <input type="number" className={fieldCls} value={hc.medicareStartAge} onChange={(e) => updateHealthcare({ medicareStartAge: Number(e.target.value) })} />
          </Field>
          <Field label="Both Carry Part B">
            <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={hc.bothCarryPartB ? 'yes' : 'no'} onChange={(v) => updateHealthcare({ bothCarryPartB: v === 'yes' })} />
          </Field>
          <Field label="Model IRMAA">
            <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={hc.irmaaEnabled ? 'yes' : 'no'} onChange={(v) => updateHealthcare({ irmaaEnabled: v === 'yes' })} />
          </Field>
        </div>
      </Section>

      <Section title="Social Security" subtitle="When on, claim ages drive the projection instead of income streams">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Use SS Module">
            <Segmented options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} value={scn.socialSecurity.enabled ? 'on' : 'off'} onChange={(v) => updateSocialSecurity({ enabled: v === 'on' })} />
          </Field>
          {scn.socialSecurity.claims.map((claim) => (
            <Field key={claim.owner} label={`${claim.owner === 'self' ? 'Self' : 'Spouse'} Claim Age`}>
              <input type="number" className={fieldCls} value={claim.claimAge} onChange={(e) => updateSsClaim(claim.owner, { claimAge: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Long-Term Care Stress Test" subtitle="Models an uncovered care cost (off by default)">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Enable LTC">
            <Segmented options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} value={ltc.crissyEnabled ? 'on' : 'off'} onChange={(v) => updateLongTermCare({ crissyEnabled: v === 'on' })} />
          </Field>
          <Field label="Cost $/mo (today's $)">
            <input type="number" className={fieldCls} value={ltc.monthly} onChange={(e) => updateLongTermCare({ monthly: Number(e.target.value) })} />
          </Field>
          <Field label="Start Age">
            <input type="number" className={fieldCls} value={ltc.startAge} onChange={(e) => updateLongTermCare({ startAge: Number(e.target.value) })} />
          </Field>
          <Field label="Years">
            <input type="number" className={fieldCls} value={ltc.years} onChange={(e) => updateLongTermCare({ years: Number(e.target.value) })} />
          </Field>
        </div>
      </Section>

      <Section title="Data" subtitle="Your plan is stored locally in this browser. Back it up regularly.">
        {msg && <div className="mb-4 rounded-lg border border-primary/40 bg-primary-tint px-4 py-2 text-[13px] text-ink">{msg}</div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doExport}>Export JSON backup</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Import JSON backup</Button>
          <Button variant="danger" onClick={onReset}>Reset demo data</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
        </div>
      </Section>
    </div>
  );
}
