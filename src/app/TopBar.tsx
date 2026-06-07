import { useState } from 'react';
import { useStore, useEffectiveDisplayMode } from '@/state/store';
import { Button, ScenarioChip, Segmented } from '@/components/ui/primitives';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { IconPlus } from '@/components/icons';
import type { PresetKey } from '@/domain/types';

export function TopBar() {
  const scenarios = useStore((s) => s.scenarios);
  const activeId = useStore((s) => s.activeScenarioId);
  const select = useStore((s) => s.selectScenario);
  const createFromPreset = useStore((s) => s.createFromPreset);
  const duplicate = useStore((s) => s.duplicateActive);
  const setOverride = useStore((s) => s.setDisplayModeOverride);
  const displayMode = useEffectiveDisplayMode();

  const [menuOpen, setMenuOpen] = useState(false);

  const newScenario = (key: PresetKey | 'duplicate') => {
    setMenuOpen(false);
    if (key === 'duplicate') duplicate();
    else createFromPreset(key);
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-base px-8 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <ScenarioChip key={s.id} label={s.name} active={s.id === activeId} onClick={() => select(s.id)} />
        ))}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setMenuOpen((o) => !o)}>
            <IconPlus className="h-4 w-4" /> New Scenario
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border-strong bg-card-high shadow-overlay">
                {(['conservative', 'moderate', 'aggressive'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => newScenario(k)}
                    className="block w-full px-4 py-2 text-left text-[13px] capitalize text-muted hover:bg-hover hover:text-ink"
                  >
                    From {k} preset
                  </button>
                ))}
                <button
                  onClick={() => newScenario('duplicate')}
                  className="block w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
                >
                  Duplicate current
                </button>
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
