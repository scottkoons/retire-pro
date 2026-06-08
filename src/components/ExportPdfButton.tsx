import { useState } from 'react';
import clsx from 'clsx';
import { useActiveScenario, useEffectiveDisplayMode, useStore } from '@/state/store';
import { useProjection } from '@/selectors/projection';
import { useMcStore } from '@/state/mcStore';
import { Button } from '@/components/ui/primitives';
import { IconDownload } from '@/components/icons';

export function ExportPdfButton({
  variant = 'primary',
  size = 'sm',
}: {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const scn = useActiveScenario();
  const { result } = useProjection();
  const displayMode = useEffectiveDisplayMode();
  const household = useStore((s) => s.settings.household);
  const settings = useStore((s) => s.settings);
  const mc = useMcStore((s) => s.result);

  const [open, setOpen] = useState(false);
  const [includeMc, setIncludeMc] = useState(true);
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportPlanSummaryPdf } = await import('@/pdf/exportPlanSummaryPdf');
      await exportPlanSummaryPdf({
        scenario: scn,
        projection: result,
        displayMode,
        household,
        settings,
        monteCarlo: mc ?? undefined,
        includeMonteCarlo: includeMc && !!mc,
      });
      setOpen(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert('PDF export failed: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <Button variant={variant} size={size} onClick={() => setOpen((o) => !o)}>
        <IconDownload className="h-4 w-4" /> Export PDF
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border-strong bg-card-high p-3 shadow-overlay">
            <div className="label-mono mb-2">PDF Options</div>
            <label
              className={clsx(
                'flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px]',
                mc ? 'cursor-pointer text-ink' : 'cursor-not-allowed text-faint',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={includeMc && !!mc}
                disabled={!mc}
                onChange={(e) => setIncludeMc(e.target.checked)}
              />
              <span>Include Monte Carlo</span>
              {!mc && <span className="ml-auto font-mono text-[10px]">run it first</span>}
            </label>
            <Button variant="primary" size="sm" onClick={doExport} disabled={exporting} className="mt-2 w-full">
              {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
