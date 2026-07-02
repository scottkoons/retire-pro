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

const KEYS: { key: keyof IncomePoint; color: string; label: string }[] = [
  { key: 'investment', color: SERIES.investment.color, label: SERIES.investment.label },
  { key: 'va', color: SERIES.va.color, label: SERIES.va.label },
  { key: 'ssSelf', color: SERIES.ssSelf.color, label: 'Social Security (Scott)' },
  { key: 'ssSpouse', color: SERIES.ssSpouse.color, label: 'Social Security (Crissy)' },
  { key: 'other', color: SERIES.other.color, label: SERIES.other.label },
];

export function IncomeChart({ data, height = 280 }: { data: IncomePoint[]; height?: number }) {
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
          <Tooltip
            contentStyle={{
              background: chart.tooltipBg,
              border: `1px solid ${chart.tooltipBorder}`,
              borderRadius: 8,
              fontFamily: 'Inter',
            }}
            labelStyle={{ color: '#94a3b8', fontFamily: 'Inter Variable', fontSize: 11 }}
            formatter={(v: number) => fmtUSD(v)}
            labelFormatter={(a) => `Age ${a}`}
          />
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
