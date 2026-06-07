import { useRef, useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Button, Segmented } from '@/components/ui/primitives';
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
  const setAssumption = useStore((s) => s.setAssumption);
  const docFor = useStore;
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
