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
import type { DisplayMode, YearRow } from '@/domain/types';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';

// Net-worth composition series, ordered bottom -> top for the stack.
const SERIES: { key: 'taxable' | 'pretax' | 'roth' | 'homeEquity'; color: string; label: string }[] = [
  { key: 'taxable', color: chart.cat[1], label: 'Taxable' },
  { key: 'pretax', color: chart.cat[5], label: 'Pre-tax' },
  { key: 'roth', color: chart.cat[3], label: 'Roth' },
  { key: 'homeEquity', color: chart.cat[2], label: 'Home equity' },
];

function NetWorthTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value as number | undefined;
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {SERIES.map((s) => {
        const v = get(s.key);
        if (v == null) return null;
        return (
          <div key={s.key} className="flex items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(v)}</span>
          </div>
        );
      })}
      {get('netWorth') != null && (
        <div className="mt-1.5 flex items-center gap-2 border-t border-border-subtle pt-1.5 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
          <span className="text-muted">Net worth</span>
          <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(get('netWorth') as number)}</span>
        </div>
      )}
    </div>
  );
}

export function NetWorthChart({
  rows,
  displayMode,
  height = 320,
}: {
  rows: YearRow[];
  displayMode: DisplayMode;
  height?: number;
}) {
  const data = useMemo(() => {
    return rows.map((r) => {
      // In "today" mode, deflate nominal dollars back to today's purchasing power.
      const defl = displayMode === 'today' ? r.cpiFactor || 1 : 1;
      return {
        age: r.age,
        taxable: (r.accountBalances?.taxable ?? 0) / defl,
        pretax: (r.accountBalances?.pretax ?? 0) / defl,
        roth: (r.accountBalances?.roth ?? 0) / defl,
        homeEquity: (r.homeEquity ?? 0) / defl,
        netWorth: (r.netWorth ?? 0) / defl,
      };
    });
  }, [rows, displayMode]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
          Net worth
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
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
          <Tooltip content={<NetWorthTooltip />} />

          {/* Stacked composition areas, bottom -> top */}
          {SERIES.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stackId="nw"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          ))}

          {/* Total net-worth overlay line (not part of the stack) */}
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke={chart.primary}
            strokeWidth={2.5}
            dot={false}
            fill="none"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
