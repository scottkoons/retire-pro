import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveScenario, useStore } from '@/state/store';
import { Section, Button, Segmented, NumField, MoneyInput } from '@/components/ui/primitives';
import { IconTrash } from '@/components/icons';
import { exportBackup, parseBackup, backupJSON } from '@/persistence/storage';
import { birthDateISO, spouseBirthDateISO, spouseCurrentAge } from '@/lib/dates';
import { fmtAgeYM } from '@/lib/format';
import { seedDocument } from '@/domain/seed';
import { AccountsManager } from './AccountsManager';
import { useAiStore } from '@/ai/aiStore';
import { hasActiveKey, maskKey, PROVIDER_LABELS, type AiProviderId } from '@/ai/config';
import { FALLBACK_MODELS, fetchProviderModels, withCurrentModel, type ModelOption } from '@/ai/models';
import type { PersistedDocument } from '@/domain/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

/**
 * Binds the plan to a real file on disk so every autosave writes through.
 * localStorage lives inside the browser profile, where no backup tool can see
 * it and "Clear browsing data" erases it; a file in an already-backed-up folder
 * fixes both, and is what the app reads back if this browser is ever wiped.
 */
function PlanFilePanel() {
  const planFile = useStore((s) => s.planFile);
  const connectPlanFile = useStore((s) => s.connectPlanFile);
  const attachPlanFile = useStore((s) => s.attachPlanFile);
  const reconnectPlanFile = useStore((s) => s.reconnectPlanFile);
  const disconnectPlanFile = useStore((s) => s.disconnectPlanFile);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = run(async () => {
    if (!confirm('Stop writing your plan to disk?\n\nThe file itself is left alone, and your plan stays saved in this browser.')) return;
    await disconnectPlanFile();
  });

  const lastWrite = planFile.lastWriteAt ? new Date(planFile.lastWriteAt) : null;

  return (
    <Section
      title="Plan File"
      subtitle="Mirror every save to a real file on disk, so a folder you already back up covers your plan too"
    >
      {planFile.status === 'unsupported' ? (
        <p className="text-[13px] text-muted">
          This browser cannot write directly to a file. Chrome and Edge support it; Safari and Firefox do not. Until then,
          use "Export JSON backup" below to keep a copy outside the browser.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border-subtle bg-card-high px-4 py-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                planFile.status === 'connected'
                  ? 'bg-success'
                  : planFile.status === 'error'
                    ? 'bg-error'
                    : planFile.status === 'needs-permission'
                      ? 'bg-caution'
                      : 'bg-border-strong'
              }`}
            />
            {planFile.status === 'connected' && (
              <>
                <span className="text-[14px] font-semibold text-ink">{planFile.name}</span>
                <span className="text-[12px] text-muted">
                  {lastWrite ? `Written at ${lastWrite.toLocaleTimeString()}` : 'Waiting for the next save'}
                </span>
              </>
            )}
            {planFile.status === 'needs-permission' && (
              <span className="text-[13px] text-ink">
                {planFile.name ?? 'Your plan file'} is remembered, but this browser needs permission again before it can be
                written.
              </span>
            )}
            {planFile.status === 'off' && <span className="text-[13px] text-muted">Not saving to a file yet.</span>}
            {planFile.status === 'error' && <span className="text-[13px] text-error">{planFile.error}</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            {planFile.status === 'needs-permission' && (
              <Button disabled={busy} onClick={run(reconnectPlanFile)}>
                Reconnect
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={run(connectPlanFile)}>
              {planFile.status === 'connected' ? 'Change file…' : 'Choose plan file…'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={run(attachPlanFile)}>
              Use an existing plan file…
            </Button>
            {planFile.status !== 'off' && (
              <Button variant="danger" disabled={busy} onClick={onDisconnect}>
                Stop saving to disk
              </Button>
            )}
          </div>

          <p className="text-[11px] text-faint">
            "Choose plan file" creates the file and overwrites whatever is at that name. "Use an existing plan file"
            attaches to one you already have and asks which copy to keep. Pick somewhere your backups already reach, for
            example inside your Sync folder. Chrome asks for permission again after each restart, which is one click.
          </p>
        </div>
      )}
    </Section>
  );
}

const AI_PROVIDERS: AiProviderId[] = ['anthropic', 'openai'];

/** Per-provider state for the model dropdown. */
interface ModelListState {
  options: ModelOption[];
  /** True once the provider itself supplied the list. */
  live: boolean;
  loading: boolean;
  error: string | null;
}

const initialModelLists = (): Record<AiProviderId, ModelListState> => ({
  anthropic: { options: FALLBACK_MODELS.anthropic, live: false, loading: false, error: null },
  openai: { options: FALLBACK_MODELS.openai, live: false, loading: false, error: null },
});

/**
 * API keys for the optional AI features.
 *
 * Keys live under their own localStorage entry, never inside the plan document
 * (see ai/config.ts), so they cannot leak into an exported backup, the
 * clipboard transfer, or the plan file on disk.
 */
function AiSettingsPanel() {
  const config = useAiStore((s) => s.config);
  const setConfig = useAiStore((s) => s.setConfig);
  const forgetKeys = useAiStore((s) => s.forgetKeys);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [modelLists, setModelLists] = useState<Record<AiProviderId, ModelListState>>(initialModelLists);

  const providers = AI_PROVIDERS;

  const patch = (id: AiProviderId, field: 'apiKey' | 'model', value: string) => {
    setConfig({ ...config, [id]: { ...config[id], [field]: value } });
    setResult(null);
  };

  /**
   * Replace a provider's dropdown with the models its own key can reach.
   * Listing models is free and read-only, so this runs on open rather than
   * making the user press anything to see a real line-up.
   */
  const loadModels = useCallback(async (id: AiProviderId, apiKey: string) => {
    if (!apiKey.trim()) return;
    setModelLists((s) => ({ ...s, [id]: { ...s[id], loading: true, error: null } }));
    try {
      const options = await fetchProviderModels(id, apiKey);
      setModelLists((s) => ({
        ...s,
        [id]: options.length
          ? { options, live: true, loading: false, error: null }
          : { ...s[id], loading: false, error: 'That key reached the provider but returned no usable models.' },
      }));
    } catch (err) {
      const { describeAiError } = await import('@/ai/client');
      setModelLists((s) => ({ ...s, [id]: { ...s[id], loading: false, error: describeAiError(err, id).message } }));
    }
  }, []);

  // Read through a ref so opening the page loads both lists exactly once,
  // rather than re-firing on every keystroke in a key field.
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    for (const id of AI_PROVIDERS) void loadModels(id, configRef.current[id].apiKey);
  }, [loadModels]);

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { testAiConnection } = await import('@/ai/client');
      setResult({ ok: true, text: `Connected. ${PROVIDER_LABELS[config.provider]} replied "${await testAiConnection(config)}".` });
      // The key just proved it works, so this is the moment its real model
      // line-up becomes available.
      void loadModels(config.provider, config[config.provider].apiKey);
    } catch (err) {
      const { describeAiError } = await import('@/ai/client');
      const d = describeAiError(err, config.provider);
      setResult({ ok: false, text: d.hint ? `${d.message} ${d.hint}` : d.message });
    } finally {
      setTesting(false);
    }
  };

  const onForget = () => {
    if (!confirm('Remove both API keys from this browser?')) return;
    forgetKeys();
    setResult(null);
    setModelLists(initialModelLists()); // no key left to list models with
  };

  const inputCls =
    'rounded-md border border-border-strong bg-input px-2.5 py-1.5 font-mono text-[13px] text-ink focus:border-primary focus:outline-none';

  /** Where this provider's dropdown came from, or why it could not be loaded. */
  const modelStatus = (id: AiProviderId): string => {
    const list = modelLists[id];
    if (list.loading) return 'Loading the model list…';
    if (list.error) return list.error;
    if (list.live) return `${list.options.length} model${list.options.length === 1 ? '' : 's'} on this key`;
    if (!config[id].apiKey.trim()) return 'Built-in list. Add a key to load the models your account can use.';
    return 'Built-in list.';
  };

  return (
    <Section
      title="AI Assistant"
      subtitle="Optional. Adds a plain-English read of your plan on the Plan Summary page."
      actions={
        <Segmented
          size="sm"
          options={providers.map((p) => ({ value: p, label: p === 'anthropic' ? 'Claude' : 'OpenAI' }))}
          value={config.provider}
          onChange={(v) => {
            setConfig({ ...config, provider: v });
            setResult(null);
          }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {providers.map((id) => {
            // The saved model is always offered, even if this key cannot see it.
            const options = withCurrentModel(modelLists[id].options, config[id].model);
            const selected = options.find((o) => o.id === config[id].model);
            return (
            <div
              key={id}
              className={`rounded-xl border p-4 ${config.provider === id ? 'border-primary/50 bg-card-high' : 'border-border-subtle bg-card-high opacity-70'}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">{PROVIDER_LABELS[id]}</span>
                {config.provider === id && (
                  <span className="rounded-full bg-primary-tint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                    In use
                  </span>
                )}
              </div>
              <Field label="API Key">
                <div className="flex items-center gap-1.5">
                  <input
                    type={reveal[id] ? 'text' : 'password'}
                    value={config[id].apiKey}
                    onChange={(e) => patch(id, 'apiKey', e.target.value)}
                    placeholder={id === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`${PROVIDER_LABELS[id]} API key`}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReveal((r) => ({ ...r, [id]: !r[id] }))}
                    title={reveal[id] ? 'Hide the key' : 'Show the key'}
                  >
                    {reveal[id] ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {config[id].apiKey && !reveal[id] && (
                  <span className="mt-0.5 font-mono text-[11px] text-faint">{maskKey(config[id].apiKey)}</span>
                )}
              </Field>
              <div className="mt-3">
                <Field label="Model">
                  <select
                    value={config[id].model}
                    onChange={(e) => patch(id, 'model', e.target.value)}
                    aria-label={`${PROVIDER_LABELS[id]} model`}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
                  {/* Anthropic names its models for people, so show what is actually sent. */}
                  {selected && selected.label !== selected.id && <span>Sends {selected.id}</span>}
                  <span className={modelLists[id].error ? 'text-error' : undefined}>{modelStatus(id)}</span>
                  <button
                    type="button"
                    onClick={() => void loadModels(id, config[id].apiKey)}
                    disabled={modelLists[id].loading || !config[id].apiKey.trim()}
                    className="underline underline-offset-2 text-primary disabled:text-faint disabled:no-underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {result && (
          <div
            className={`rounded-lg border px-4 py-2 text-[13px] ${result.ok ? 'border-success/40 bg-success-tint text-success' : 'border-error/40 bg-error-tint text-error'}`}
          >
            {result.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={testing || !hasActiveKey(config)} onClick={onTest}>
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
          <Button variant="danger" onClick={onForget}>
            Forget keys
          </Button>
        </div>

        <p className="text-[11px] text-faint">
          Keys are stored only in this browser and are sent only to the provider they belong to. They are deliberately kept
          out of the plan document, so exporting a backup or writing the plan file never includes them. Once a key is
          saved, each model list is loaded from that provider, so it shows what your own account can actually reach;
          without a key you get a built-in list instead. Press Refresh after changing a key.
        </p>
      </div>
    </Section>
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
                <input type="date" className={`${fieldCls}`} value={birthDateISO(scn.assumptions)} onChange={(e) => e.target.value && setBirthDate(e.target.value)} />
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
                <input type="date" className={`${fieldCls}`} value={spouseBirthDateISO(scn.assumptions)} onChange={(e) => e.target.value && setSpouseBirthDate(e.target.value)} />
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

      <AiSettingsPanel />

      <PlanFilePanel />

      <Section title="Data" subtitle="Your plan is saved in this browser, and to your plan file when one is connected above. Export a backup before any big change.">
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
