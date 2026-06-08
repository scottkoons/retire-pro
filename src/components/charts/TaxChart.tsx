import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { YearRow } from '@/domain/types';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev, fmtPct } from '@/lib/format';

// Each stacked tax/cost layer. The order here is also the stack order (bottom -> top)
// and the legend order. Colors come from the categorical palette.
const TAX_KEYS: { key: TaxPointKey; color: string; label: string }[] = [
  { key: 'federalTax', color: chart.cat[4], label: 'Federal' },
  { key: 'stateTax', color: chart.cat[5], label: 'State' },
  { key: 'capGainsTax', color: chart.cat[1], label: 'Cap Gains' },
  { key: 'niit', color: chart.cat[2], label: 'NIIT' },
  { key: 'irmaa', color: chart.cat[3], label: 'IRMAA' },
];

type TaxPointKey = 'federalTax' | 'stateTax' | 'capGainsTax' | 'niit' | 'irmaa';

interface TaxPoint {
  age: number;
  federalTax: number;
  stateTax: number;
  capGainsTax: number;
  niit: number;
  irmaa: number;
  effectiveRate: number;
  marginalRate: number;
}

function TaxTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  // The payload carries the full TaxPoint via any series; read it directly so we can
  // show every tax line plus both rates regardless of which areas are non-zero.
  const point = payload[0]?.payload as TaxPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {TAX_KEYS.map((k) => (
        <div key={k.key} className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
          <span className="text-muted">{k.label}</span>
          <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(point[k.key])}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center gap-2 border-t border-border-subtle pt-1.5 text-[13px]">
        <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
        <span className="text-muted">Effective rate</span>
        <span className="ml-auto font-mono tabnum text-ink">{fmtPct(point.effectiveRate)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        <span className="text-faint">Marginal rate</span>
        <span className="ml-auto font-mono tabnum text-muted">{fmtPct(point.marginalRate)}</span>
      </div>
    </div>
  );
}

export function TaxChart({ rows, height = 300 }: { rows: YearRow[]; height?: number }) {
  // Flatten rows into chart points. All v2 tax fields are optional, so null-guard each.
  // Pre-retirement years are typically all-zero, which is expected.
  const data = useMemo<TaxPoint[]>(
    () =>
      rows.map((r) => ({
        age: r.age,
        federalTax: r.federalTax ?? 0,
        stateTax: r.stateTax ?? 0,
        capGainsTax: r.capGainsTax ?? 0,
        niit: r.niit ?? 0,
        irmaa: r.irmaa ?? 0,
        effectiveRate: r.effectiveRate ?? 0,
        marginalRate: r.marginalRate ?? 0,
      })),
    [rows],
  );

  return (
    <div>
      {/* Hand-rolled legend */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
        {TAX_KEYS.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
          Effective rate
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="age"
            stroke={chart.axis}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: chart.axis }}
            tickFormatter={(a) => `Age ${a}`}
          />
          {/* Left axis: stacked dollar amounts */}
          <YAxis
            stroke={chart.axis}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: chart.axis }}
            tickFormatter={(n) => fmtUSDAbbrev(n)}
          />
          {/* Right axis: effective-rate line */}
          <YAxis
            yAxisId="rate"
            orientation="right"
            stroke={chart.axis}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, 'auto']}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: chart.axis }}
            tickFormatter={(v) => fmtPct(v, 0)}
          />
          <Tooltip content={<TaxTooltip />} cursor={{ stroke: chart.grid }} />

          {TAX_KEYS.map((k) => (
            <Area
              key={k.key}
              type="monotone"
              dataKey={k.key}
              stackId="tax"
              stroke={k.color}
              strokeWidth={1}
              fill={k.color}
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          ))}

          {/* Effective tax rate on the secondary right-hand axis */}
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="effectiveRate"
            stroke={chart.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
