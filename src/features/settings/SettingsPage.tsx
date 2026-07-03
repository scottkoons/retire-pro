import { useRef, useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Button, Segmented, NumField, MoneyInput } from '@/components/ui/primitives';
import { IconTrash } from '@/components/icons';
import { exportBackup, parseBackup, backupJSON } from '@/persistence/storage';
import { birthDateISO, spouseBirthDateISO, spouseCurrentAge } from '@/lib/dates';
import { fmtAgeYM } from '@/lib/format';
import { seedDocument } from '@/domain/seed';
import { AccountsManager } from './AccountsManager';
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
  const setBirthDate = useStore((s) => s.setBirthDate);
  const setSpouseBirthDate = useStore((s) => s.setSpouseBirthDate);
  const updateSsClaim = useStore((s) => s.updateSsClaim);
  const setSsPlannerEnabled = useStore((s) => s.setSsPlannerEnabled);
  const docFor = useStore;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fieldCls = 'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[14px] text-ink focus:border-primary focus:outline-none';

  const buildDoc = (): PersistedDocument => {
    const st = docFor.getState();
    return {
      schemaVersion: st.schemaVersion,
      appVersion: st.appVersion,
      savedAt: st.savedAt,
      scenarios: st.scenarios,
      activeScenarioId: st.activeScenarioId,
      settings: st.settings,
      netWorth: st.netWorth,
    };
  };

  const doExport = () => exportBackup(buildDoc());

  // Import shared by the file picker, the clipboard, and the manual textarea.
  const importText = (text: string): boolean => {
    const res = parseBackup(text);
    if (!res.ok) {
      setMsg(`Import failed: ${res.error}`);
      return false;
    }
    if (!confirm('Replace the plan on THIS device with the imported one? The current plan here is overwritten.')) return false;
    replaceDocument(res.doc);
    setMsg('Plan imported successfully.');
    return true;
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importText(await file.text());
    e.target.value = '';
  };

  // Device-to-device transfer via the clipboard. With Apple's Universal
  // Clipboard, "Copy plan" on the Mac and "Paste plan" on the iPhone moves the
  // whole plan with no files involved.
  const onCopyPlan = async () => {
    try {
      await navigator.clipboard.writeText(backupJSON(buildDoc()));
      setMsg('Plan copied to the clipboard. On your other device, open Settings and press "Paste plan" (Universal Clipboard carries it from Mac to iPhone automatically).');
    } catch {
      setMsg('Could not access the clipboard — use "Export JSON backup" instead.');
    }
  };

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const onPastePlan = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && importText(text)) return;
      if (!text) setPasteOpen(true); // empty clipboard — offer the manual box
    } catch {
      // Browser refused clipboard read (permissions vary) — manual paste box.
      setPasteOpen(true);
    }
  };

  const onReset = () => {
    if (!confirm('Replace all scenarios and settings with the demo plan? Your Net Worth statement is kept. Export a backup first if you want to keep your current plan.')) return;
    // Household net worth (and its snapshot history) is not "plan" data — keep it.
    const seed = seedDocument().doc;
    seed.netWorth = docFor.getState().netWorth;
    replaceDocument(seed);
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

      <AccountsManager />

      <Section title="Household" subtitle="Birth dates are shared by every scenario and drive both of your ages, including when each of you can claim Social Security">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-card-high p-4">
            <Field label="Your Name">
              <input type="text" className={fieldCls} value={settings.selfName ?? 'Scott'} onChange={(e) => updateSettings({ selfName: e.target.value })} />
            </Field>
            <div className="mt-3">
              <Field label="Your Birth Date">
                <input type="date" className={`${fieldCls} [color-scheme:dark]`} value={birthDateISO(scn.assumptions)} onChange={(e) => e.target.value && setBirthDate(e.target.value)} />
                <span className="mt-0.5 text-[11px] text-muted">{fmtAgeYM(scn.assumptions.currentAge)} old today</span>
              </Field>
            </div>
          </div>
          <div className="rounded-xl border border-border-subtle bg-card-high p-4">
            <Field label="Spouse's Name">
              <input type="text" className={fieldCls} value={settings.spouseName ?? 'Crissy'} onChange={(e) => updateSettings({ spouseName: e.target.value })} />
            </Field>
            <div className="mt-3">
              <Field label="Spouse's Birth Date">
                <input type="date" className={`${fieldCls} [color-scheme:dark]`} value={spouseBirthDateISO(scn.assumptions)} onChange={(e) => e.target.value && setSpouseBirthDate(e.target.value)} />
                {spouseBirthDateISO(scn.assumptions) ? (
                  <span className="mt-0.5 text-[11px] text-muted">{fmtAgeYM(spouseCurrentAge(scn.assumptions))} old today</span>
                ) : (
                  <span className="mt-0.5 text-[11px] text-caution">Not set yet — her age assumes the same as yours until you enter it</span>
                )}
              </Field>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Plan Basics" subtitle={scn.name}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Model End Age">
            <NumField className={fieldCls} value={scn.assumptions.modelEndAge} onCommit={(n) => setAssumption('modelEndAge', n)} />
          </Field>
          <Field label="Inflation %">
            <NumField step={0.1} className={fieldCls} value={+(scn.assumptions.inflation * 100).toFixed(2)} onCommit={(n) => setAssumption('inflation', n / 100)} />
          </Field>
        </div>
      </Section>

      <Section
        title="Social Security"
        subtitle="Monthly benefit quotes from your SSA statement, in today's dollars"
        actions={
          <Segmented
            size="sm"
            options={[
              { value: 'on', label: 'Planner on' },
              { value: 'off', label: 'Off' },
            ]}
            value={scn.socialSecurity.enabled ? 'on' : 'off'}
            onChange={(v) => setSsPlannerEnabled(v === 'on')}
          />
        }
      >
        <div className="flex flex-col gap-5">
          {scn.socialSecurity.claims.map((c) => (
            <div key={c.owner}>
              <div className="mb-2 text-[13px] font-semibold text-ink">{c.owner === 'self' ? (settings.selfName ?? 'Self') : (settings.spouseName ?? 'Spouse')}</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <Field label="At 62 $/mo">
                  <MoneyInput value={c.benefitAt62 ?? 0} onChange={(n) => updateSsClaim(c.owner, { benefitAt62: n })} ariaLabel={`${c.owner} benefit at 62`} />
                </Field>
                <Field label={`At FRA $/mo`}>
                  <MoneyInput value={c.benefitAtFRA} onChange={(n) => updateSsClaim(c.owner, { benefitAtFRA: n })} ariaLabel={`${c.owner} benefit at FRA`} />
                </Field>
                <Field label="At 70 $/mo">
                  <MoneyInput value={c.benefitAt70 ?? 0} onChange={(n) => updateSsClaim(c.owner, { benefitAt70: n })} ariaLabel={`${c.owner} benefit at 70`} />
                </Field>
                <Field label="FRA">
                  <NumField step={1} min={65} max={68} className={fieldCls} value={c.fra} onCommit={(n) => updateSsClaim(c.owner, { fra: n })} />
                </Field>
                <Field label="COLA %">
                  <NumField step={0.1} className={fieldCls} value={+(c.cola * 100).toFixed(1)} onCommit={(n) => updateSsClaim(c.owner, { cola: n / 100 })} />
                </Field>
              </div>
            </div>
          ))}
          <p className="text-[12px] text-faint">
            With the planner on, the fixed "Social Security" income rows are turned off and the Dashboard's claim-age controls drive the projection.
            Leave the 62 and 70 quotes at 0 to use the standard SSA reduction/credit formula from the FRA amount.
          </p>
        </div>
      </Section>

      <Section title="Monte Carlo">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Simulation Count">
            <NumField
              step={100}
              min={200}
              max={10000}
              className={fieldCls}
              value={settings.monteCarlo.simulations}
              onCommit={(n) => updateSettings({ monteCarlo: { ...settings.monteCarlo, simulations: n } })}
            />
          </Field>
          <Field label="Return Volatility %">
            <NumField
              step={0.5}
              className={fieldCls}
              value={+(settings.monteCarlo.returnVolatility * 100).toFixed(1)}
              onCommit={(n) => updateSettings({ monteCarlo: { ...settings.monteCarlo, returnVolatility: n / 100 } })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Defaults & Appearance">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Default Model End Age">
            <NumField className={fieldCls} value={settings.defaultModelEndAge} onCommit={(n) => updateSettings({ defaultModelEndAge: n })} />
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

      <Section title="Data" subtitle="Your plan is stored locally in each browser. Back it up regularly, and use Copy/Paste plan to move it between your Mac and phone.">
        {msg && <div className="mb-4 rounded-lg border border-primary/40 bg-primary-tint px-4 py-2 text-[13px] text-ink">{msg}</div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCopyPlan}>Copy plan</Button>
          <Button variant="outline" onClick={onPastePlan}>Paste plan</Button>
          <Button variant="outline" onClick={doExport}>Export JSON backup</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Import JSON backup</Button>
          <Button variant="danger" onClick={onReset}>Reset demo data</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
        </div>
        {pasteOpen && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] text-muted">
              This browser did not allow reading the clipboard directly — paste the copied plan here instead
              (long-press and Paste on a phone), then press Import.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              placeholder='{"kind":"retirepro-backup", ...}'
              aria-label="Pasted plan JSON"
              className="w-full rounded-md border border-border-strong bg-input p-3 text-[12px] text-ink focus:border-primary focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (importText(pasteText)) {
                    setPasteOpen(false);
                    setPasteText('');
                  }
                }}
              >
                Import pasted plan
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPasteOpen(false); setPasteText(''); }}>Cancel</Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-[11px] text-faint">
          Moving between devices: press "Copy plan" on this device, then "Paste plan" on the other one.
          On a Mac and iPhone signed into the same Apple ID, the clipboard transfers automatically (Universal Clipboard).
          The copy includes everything: scenarios, accounts, Social Security quotes, and the Net Worth statement.
        </p>
      </Section>
    </div>
  );
}
