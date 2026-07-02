import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { SocialSecurityClaim } from '@/domain/types';
import { ssAdjustmentFactor } from '@/engine/project';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';

interface Props {
  claim: SocialSecurityClaim;
  currentAge: number;
  endAge?: number;
  height?: number;
}

// One row per age with the running cumulative dollars for each of the three claim strategies.
interface Row {
  age: number;
  c62: number;
  c67: number; // claim at FRA (claim.fra)
  c70: number;
}

// Color + label metadata for the three plotted lines, keyed by data key.
const SERIES = [
  { key: 'c62', color: chart.cat[3] },
  { key: 'c67', color: chart.primary },
  { key: 'c70', color: chart.cat[5] },
] as const;

function ClaimTooltip({ active, payload, label, fra }: TooltipProps<number, string> & { fra: number }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value as number | undefined;
  const labelFor = (k: string) =>
    k === 'c62' ? 'Claim 62' : k === 'c70' ? 'Claim 70' : `Claim ${Math.round(fra)} (FRA)`;
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {SERIES.map((s) => {
        const v = get(s.key);
        if (v == null) return null;
        return (
          <div key={s.key} className="flex items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{labelFor(s.key)}</span>
            <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SsClaimCompare({ claim, currentAge, endAge = 95, height = 300 }: Props) {
  const fraAge = claim.fra;

  const { data, breakEven } = useMemo(() => {
    // Annual benefit at calendar age `a` under a chosen claim age. Benefits accrue only
    // once the person has reached the claim age; growth is COLA-compounded from today.
    const annualAt = (a: number, claimAge: number): number => {
      if (a < claimAge) return 0;
      const monthly = claim.benefitAtFRA * ssAdjustmentFactor(claimAge, claim.fra);
      const yearsFromNow = a - currentAge;
      return monthly * 12 * Math.pow(1 + claim.cola, yearsFromNow);
    };

    const start = Math.floor(currentAge);
    const rows: Row[] = [];
    let c62 = 0;
    let c67 = 0;
    let c70 = 0;
    let breakEvenAge: number | null = null;

    for (let a = start; a <= endAge; a++) {
      c62 += annualAt(a, 62);
      c67 += annualAt(a, fraAge);
      c70 += annualAt(a, 70);
      // First age at which delaying to 70 has cumulatively caught up to claiming at 62.
      if (breakEvenAge == null && c70 >= c62 && c70 > 0) breakEvenAge = a;
      rows.push({ age: a, c62, c67, c70 });
    }

    return { data: rows, breakEven: breakEvenAge };
  }, [claim.benefitAtFRA, claim.cola, claim.fra, fraAge, currentAge, endAge]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="age"
            stroke={chart.axis}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
            tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }}
            tickFormatter={(a) => `Age ${a}`}
          />
          <YAxis
            stroke={chart.axis}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontFamily: 'Inter Variable', fontSize: 11, fill: chart.axis }}
            tickFormatter={(n) => fmtUSDAbbrev(n)}
          />
          <Tooltip content={<ClaimTooltip fra={fraAge} />} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: s.color, stroke: chart.bgBase, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Hand-rolled legend + break-even caption */}
      <div className="mt-2 px-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chart.cat[3] }} />
            Claim 62
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
            Claim {Math.round(fraAge)} (FRA)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chart.cat[5] }} />
            Claim 70
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted">
          Delaying to 70 overtakes claiming at 62 at age {breakEven ?? '—'}.
        </div>
      </div>
    </div>
  );
}
