import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useActiveScenario, useStore } from '@/state/store';
import { ssMonthlyBenefitToday, isLegacySsStream } from '@/engine/project';
import { ageToMonthIndex, monthlyRate } from '@/engine/timeline';
import { Slider } from '@/components/ui/tiles';
import { IconBank } from '@/components/icons';
import { fmtUSD, fmtUSDAbbrev, fmtAgeYM } from '@/lib/format';
import type { Scenario } from '@/domain/types';

/**
 * Total Social Security collected through the end of the plan, in today's
 * dollars, if every enabled claim started at `key` (62 / own FRA / 70).
 * Strategy-independent, so it differentiates claim ages even when the
 * withdrawal strategy leaves the portfolio path unchanged.
 */
function lifetimeBenefitToday(scn: Scenario, key: '62' | 'FRA' | '70'): number {
  const a = scn.assumptions;
  const inflM = monthlyRate(a.inflation);
  const T = Math.max(1, Math.round(a.modelEndAge - a.currentAge + 1)) * 12;
  const spouseOffset = a.spouseAgeOffset ?? 0;
  let total = 0;
  for (const c of scn.socialSecurity.claims) {
    if (!c.enabled) continue;
    const claimAge = key === 'FRA' ? c.fra : Number(key);
    const monthly = ssMonthlyBenefitToday(c, claimAge);
    const colaM = monthlyRate(c.cola);
    const startSelfAge = claimAge - (c.owner === 'spouse' ? spouseOffset : 0);
    const t0 = Math.max(0, ageToMonthIndex(startSelfAge, a.currentAge));
    for (let t = t0; t < T; t++) total += (monthly * Math.pow(1 + colaM, t)) / Math.pow(1 + inflM, t);
  }
  return total;
}

/**
 * Compact dashboard strip for the Social Security planner: a claim-age slider per
 * person (independent of the retirement age), the resulting monthly benefit from
 * the SSA quotes, the "invest until retirement" toggle, and a quick comparison of
 * claiming at 62 / FRA / 70. Quotes are entered in Settings.
 */
export function SocialSecurityPanel() {
  const navigate = useNavigate();
  const scn = useActiveScenario();
  const updateSsClaim = useStore((s) => s.updateSsClaim);
  const updateSocialSecurity = useStore((s) => s.updateSocialSecurity);
  const setSsPlannerEnabled = useStore((s) => s.setSsPlannerEnabled);

  const ss = scn.socialSecurity;
  const retirementAge = scn.assumptions.retirementAge;
  const anyEarlyClaim = ss.claims.some((c) => c.enabled && c.claimAge < retirementAge);
  // Enabling the planner disables the linked legacy row; the engine itself
  // refuses to double-count it regardless (see streamNominalAt), but flag a
  // stray enabled row anyway so the Planner Sheet doesn't look inconsistent.
  const dupStreams = ss.enabled ? scn.incomeStreams.filter((st) => st.enabled && isLegacySsStream(st)) : [];

  // Lifetime benefit collected through the plan end if both claim at 62 / FRA / 70.
  const compare = useMemo(() => {
    if (!ss.enabled) return [];
    return (['62', 'FRA', '70'] as const).map((key) => ({ key, total: lifetimeBenefitToday(scn, key) }));
  }, [scn, ss.enabled]);
  const best = compare.length ? Math.max(...compare.map((c) => c.total)) : 0;

  if (!ss.enabled) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-primary"><IconBank className="h-4 w-4" /></span>
          <span className="label-mono">Social Security</span>
          <span className="text-[12px] text-muted">Off — the fixed income rows drive the projection</span>
          <button
            type="button"
            onClick={() => setSsPlannerEnabled(true)}
            className="ml-auto inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint"
          >
            Enable claim-age planner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-card px-4 pb-4 pt-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-primary"><IconBank className="h-4 w-4" /></span>
        <span className="label-mono">Social Security</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted" title="Benefits claimed before retirement are deposited into the portfolio each month instead of being spent">
          <input
            type="checkbox"
            checked={!!ss.investUntilRetirement}
            onChange={(e) => updateSocialSecurity({ investUntilRetirement: e.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer accent-primary"
          />
          Invest until retirement
        </label>
        {anyEarlyClaim && !ss.investUntilRetirement && (
          <span className="text-[11px] text-caution">pre-retirement checks treated as spent</span>
        )}
        {dupStreams.length > 0 && (
          <span className="text-[11px] text-error">
            "{dupStreams[0].name}" income row is still on — turn it off on the Planner Sheet to keep things tidy
            (the projection itself already ignores it while the planner is on)
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => navigate('/settings')} className="rounded-md px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint">
            SSA quotes
          </button>
          <button type="button" onClick={() => setSsPlannerEnabled(false)} className="rounded-md px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink">
            Turn off
          </button>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        {ss.claims.filter((c) => c.enabled).map((c) => (
          <div key={c.owner} className="rounded-lg border border-border-subtle bg-card-high px-3 pb-3 pt-2">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink">{c.owner === 'self' ? 'Scott' : 'Crissy'}</span>
              <span className="text-[12px] text-muted">
                claims at <span className="font-semibold text-ink">{fmtAgeYM(c.claimAge)}</span>
              </span>
            </div>
            <Slider min={62} max={70} step={1 / 12} value={c.claimAge} onChange={(v) => updateSsClaim(c.owner, { claimAge: v })} aria-label={`${c.owner} claim age`} />
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className="text-faint">62 – 70</span>
              <span className="font-semibold text-ink tabnum">{fmtUSD(ssMonthlyBenefitToday(c))}/mo <span className="font-normal text-faint">today's $</span></span>
            </div>
          </div>
        ))}

        {/* Claiming-age comparison: total collected through the end of the plan. */}
        <div className="rounded-lg border border-border-subtle bg-card-high px-3 pb-3 pt-2">
          <div className="mb-1.5 text-[12px] font-semibold text-ink">
            Lifetime benefit if both claim at
          </div>
          <div className="flex items-stretch gap-2">
            {compare.map((cmp) => (
              <div
                key={cmp.key}
                className={clsx(
                  'flex-1 rounded-md border px-2 py-1.5 text-center',
                  cmp.total === best ? 'border-success/50 bg-success-tint' : 'border-border-subtle',
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{cmp.key}</div>
                <div className={clsx('text-[14px] font-bold tabnum', cmp.total === best ? 'text-success' : 'text-ink')}>
                  {fmtUSDAbbrev(cmp.total)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[11px] text-faint">collected through {fmtAgeYM(scn.assumptions.modelEndAge)} · today's $</div>
        </div>
      </div>
    </div>
  );
}
