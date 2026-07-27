import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Section, Button } from '@/components/ui/primitives';
import { useAiStore } from '@/ai/aiStore';
import { hasActiveKey, PROVIDER_LABELS } from '@/ai/config';
import { describeAiError } from '@/ai/client';
import type { PlanSummaryModel } from '@/selectors/planSummary';

/**
 * Plain-English read of the projection.
 *
 * Every figure shown anywhere on this page comes from the engine; this panel
 * only adds interpretation. The narrator is handed the finished summary model
 * and is instructed not to compute anything (see ai/narrate.ts), so it can
 * describe and prioritise but never contradict the tables above it.
 */
export function PlanNarrator({ summary, scenarioId }: { summary: PlanSummaryModel; scenarioId: string }) {
  const config = useAiStore((s) => s.config);
  const text = useAiStore((s) => s.narrations[scenarioId]);
  const setNarration = useAiStore((s) => s.setNarration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const ready = hasActiveKey(config);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Lazily imported so neither provider SDK is in the initial bundle.
      const { narratePlan } = await import('@/ai/narrate');
      setNarration(scenarioId, await narratePlan(config, summary));
    } catch (err) {
      setError(describeAiError(err, config.provider));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="What this plan says"
      subtitle={ready ? `Written by ${PROVIDER_LABELS[config.provider]} from the numbers above` : undefined}
      actions={
        ready ? (
          <Button variant={text ? 'ghost' : 'primary'} size="sm" disabled={busy} onClick={run}>
            {busy ? 'Reading the plan…' : text ? 'Regenerate' : 'Explain this plan'}
          </Button>
        ) : undefined
      }
    >
      {!ready ? (
        <p className="text-[13px] text-muted">
          Add an API key in{' '}
          <Link to="/settings" className="text-primary hover:underline">
            Settings
          </Link>{' '}
          to have this plan explained in plain English.
        </p>
      ) : error ? (
        <div className="rounded-lg border border-error/40 bg-error-tint px-4 py-3 text-[13px] text-error">
          {error.message}
          {error.hint && <span className="ml-1 text-muted">{error.hint}</span>}
        </div>
      ) : text ? (
        <div className="flex flex-col gap-3">
          {text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} className="text-[14px] leading-relaxed text-ink">
                {p}
              </p>
            ))}
          <p className="text-[11px] text-faint">
            Written by {PROVIDER_LABELS[config.provider]} from the projection on this page. Every figure is produced by the
            planner itself; this is interpretation, not advice, and it is worth reading against the tables below.
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          {busy ? 'Reading the plan…' : 'Get a short read of what drives this outcome and where it is fragile.'}
        </p>
      )}
    </Section>
  );
}
