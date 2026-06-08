import { useState } from 'react';
import { useStore, useEffectiveDisplayMode, useActiveScenario } from '@/state/store';
import { Button, ScenarioChip, Segmented } from '@/components/ui/primitives';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { IconPlus, IconPencil, IconTrash } from '@/components/icons';
import type { PresetKey } from '@/domain/types';

export function TopBar() {
  const scenarios = useStore((s) => s.scenarios);
  const activeId = useStore((s) => s.activeScenarioId);
  const active = useActiveScenario();
  const select = useStore((s) => s.selectScenario);
  const createFromPreset = useStore((s) => s.createFromPreset);
  const createBlank = useStore((s) => s.createBlank);
  const duplicate = useStore((s) => s.duplicateActive);
  const renameScenario = useStore((s) => s.renameScenario);
  const deleteScenario = useStore((s) => s.deleteScenario);
  const setOverride = useStore((s) => s.setDisplayModeOverride);
  const displayMode = useEffectiveDisplayMode();

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const newScenario = (key: PresetKey | 'duplicate' | 'blank') => {
    setNewOpen(false);
    if (key === 'duplicate') duplicate();
    else if (key === 'blank') createBlank();
    else createFromPreset(key);
  };

  const startEdit = () => {
    setDraft(active.name);
    setEditing(true);
  };
  const commitEdit = () => {
    if (draft.trim() && draft.trim() !== active.name) renameScenario(active.id, draft);
    setEditing(false);
  };
  const onDelete = () => {
    if (scenarios.length <= 1) return;
    if (confirm(`Delete scenario "${active.name}"? This cannot be undone.`)) deleteScenario(active.id);
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-base px-8 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((sc) =>
          editing && sc.id === activeId ? (
            <input
              key={sc.id}
              autoFocus
              value={draft}
              size={Math.max(10, draft.length + 1)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                else if (e.key === 'Escape') setEditing(false);
              }}
              aria-label="Scenario name"
              className="rounded-full border border-primary bg-input px-4 py-1.5 text-[13px] font-medium text-ink focus:outline-none"
            />
          ) : (
            <ScenarioChip
              key={sc.id}
              label={sc.name}
              active={sc.id === activeId}
              onClick={() => {
                setEditing(false);
                select(sc.id);
              }}
            />
          ),
        )}

        {/* Create a new scenario */}
        <div className="relative ml-1.5">
          <Button variant="outline" size="sm" onClick={() => setNewOpen((o) => !o)}>
            <IconPlus className="h-4 w-4" /> New Scenario
          </Button>
          {newOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNewOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border-strong bg-card-high py-1 shadow-overlay">
                <button
                  onClick={() => newScenario('blank')}
                  className="block w-full px-4 py-2 text-left text-[13px] font-medium text-ink hover:bg-hover"
                >
                  Blank scenario
                </button>
                <button
                  onClick={() => newScenario('duplicate')}
                  className="block w-full px-4 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
                >
                  Duplicate “{active.name}”
                </button>
                <div className="my-1 border-t border-border-subtle" />
                <div className="label-mono px-4 pb-0.5 pt-1 text-faint">From a preset</div>
                {(['conservative', 'moderate', 'aggressive'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => newScenario(k)}
                    className="block w-full px-4 py-2 text-left text-[13px] capitalize text-muted hover:bg-hover hover:text-ink"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Rename / delete the active scenario */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={startEdit}
            title={`Rename the active scenario (“${active.name}”)`}
            aria-label="Rename the active scenario"
            className={`rounded-md p-1.5 transition-colors hover:bg-hover hover:text-primary ${editing ? 'text-primary' : 'text-muted'}`}
          >
            <IconPencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={scenarios.length <= 1}
            title={scenarios.length <= 1 ? 'Keep at least one scenario' : `Delete the active scenario (“${active.name}”)`}
            aria-label="Delete the active scenario"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-error-tint hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
        <div className="h-5 w-px bg-border-subtle" aria-hidden />
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
