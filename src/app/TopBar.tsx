import { useState } from 'react';
import { useStore, useEffectiveDisplayMode, useActiveScenario } from '@/state/store';
import { Button, ScenarioChip, Segmented } from '@/components/ui/primitives';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { IconPlus, IconChevronDown, IconTrash } from '@/components/icons';
import type { PresetKey } from '@/domain/types';

export function TopBar() {
  const scenarios = useStore((s) => s.scenarios);
  const activeId = useStore((s) => s.activeScenarioId);
  const active = useActiveScenario();
  const select = useStore((s) => s.selectScenario);
  const createFromPreset = useStore((s) => s.createFromPreset);
  const duplicate = useStore((s) => s.duplicateActive);
  const renameScenario = useStore((s) => s.renameScenario);
  const deleteScenario = useStore((s) => s.deleteScenario);
  const setOverride = useStore((s) => s.setDisplayModeOverride);
  const displayMode = useEffectiveDisplayMode();

  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const newScenario = (key: PresetKey | 'duplicate') => {
    setNewOpen(false);
    if (key === 'duplicate') duplicate();
    else createFromPreset(key);
  };

  const openManage = () => {
    setNameDraft(active.name);
    setManageOpen(true);
  };
  const commitRename = () => {
    if (nameDraft.trim() && nameDraft.trim() !== active.name) renameScenario(active.id, nameDraft);
  };
  const onDelete = () => {
    if (scenarios.length <= 1) return;
    if (confirm(`Delete scenario "${active.name}"? This cannot be undone.`)) {
      deleteScenario(active.id);
      setManageOpen(false);
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-base px-8 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <ScenarioChip key={s.id} label={s.name} active={s.id === activeId} onClick={() => select(s.id)} />
        ))}

        {/* Manage the active scenario: rename / delete */}
        <div className="relative">
          <button
            onClick={() => (manageOpen ? setManageOpen(false) : openManage())}
            title="Rename or delete the active scenario"
            className="flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-primary/50 hover:text-ink"
          >
            Manage <IconChevronDown className="h-3.5 w-3.5" />
          </button>
          {manageOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setManageOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border-strong bg-card-high p-3 shadow-overlay">
                <div className="label-mono mb-1.5">Rename “{active.name}”</div>
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitRename();
                      setManageOpen(false);
                    } else if (e.key === 'Escape') {
                      setManageOpen(false);
                    }
                  }}
                  className="mb-3 w-full rounded-md border border-border-strong bg-input px-2.5 py-1.5 text-[13px] text-ink focus:border-primary focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      commitRename();
                      setManageOpen(false);
                    }}
                    className="flex-1"
                  >
                    Save name
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={onDelete}
                    disabled={scenarios.length <= 1}
                    title={scenarios.length <= 1 ? 'Keep at least one scenario' : 'Delete this scenario'}
                  >
                    <IconTrash className="h-4 w-4" /> Delete
                  </Button>
                </div>
                {scenarios.length <= 1 && <p className="mt-2 text-[11px] text-faint">You must keep at least one scenario.</p>}
              </div>
            </>
          )}
        </div>

        {/* Create a new scenario */}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setNewOpen((o) => !o)}>
            <IconPlus className="h-4 w-4" /> New Scenario
          </Button>
          {newOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNewOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border-strong bg-card-high shadow-overlay">
                <button
                  onClick={() => newScenario('duplicate')}
                  className="block w-full px-4 py-2 text-left text-[13px] font-medium text-ink hover:bg-hover"
                >
                  Duplicate “{active.name}”
                </button>
                <div className="border-t border-border-subtle" />
                {(['conservative', 'moderate', 'aggressive'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => newScenario(k)}
                    className="block w-full px-4 py-2 text-left text-[13px] capitalize text-muted hover:bg-hover hover:text-ink"
                  >
                    From {k} preset
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Segmented
          options={[
            { value: 'today', label: "Today's $" },
            { value: 'actual', label: 'Actual $' },
          ]}
          value={displayMode}
          onChange={(v) => setOverride(v)}
        />
        <ExportPdfButton variant="primary" size="sm" />
      </div>
    </header>
  );
}
