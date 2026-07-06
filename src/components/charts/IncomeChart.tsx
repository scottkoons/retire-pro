import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chart, SERIES } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';

export interface IncomePoint {
  age: number;
  investment: number;
  va: number;
  ssSelf: number;
  ssSpouse: number;
  other: number;
}

interface SeriesMeta {
  label: string;
  color: string;
}

function IncomeTooltip({
  active,
  payload,
  label,
  meta,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string }[];
  label?: number;
  meta: Record<string, SeriesMeta>;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.map((p) => ({
    key: String(p.dataKey),
    value: typeof p.value === 'number' ? p.value : 0,
  }));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: meta[r.key]?.color }} />
            {meta[r.key]?.label ?? r.key}
          </span>
          <span className="font-semibold text-ink tabnum">{fmtUSD(r.value)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-border-strong pt-1.5 text-[12px]">
        <span className="font-medium text-muted">Total income</span>
        <span className="font-semibold text-ink tabnum">{fmtUSD(total)}</span>
      </div>
    </div>
  );
}

export function IncomeChart({
  data,
  height = 280,
  selfName = 'Scott',
  spouseName = 'Spouse',
}: {
  data: IncomePoint[];
  height?: number;
  selfName?: string;
  spouseName?: string;
}) {
  const KEYS: { key: keyof IncomePoint; color: string; label: string }[] = [
    { key: 'investment', color: SERIES.investment.color, label: SERIES.investment.label },
    { key: 'va', color: SERIES.va.color, label: SERIES.va.label },
    { key: 'ssSelf', color: SERIES.ssSelf.color, label: `Social Security (${selfName})` },
    { key: 'ssSpouse', color: SERIES.ssSpouse.color, label: `Social Security (${spouseName})` },
    { key: 'other', color: SERIES.other.color, label: SERIES.other.label },
  ];
  const meta: Record<string, SeriesMeta> = Object.fromEntries(
    KEYS.map((k) => [k.key, { label: k.label, color: k.color }]),
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
        {KEYS.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
          <Tooltip content={<IncomeTooltip meta={meta} />} />
          {KEYS.map((k) => (
            <Area
              key={k.key}
              type="monotone"
              dataKey={k.key}
              stackId="income"
              stroke="none"
              fill={k.color}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
