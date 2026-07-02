import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { DisplayMode, MarkerPoint, YearRow } from '@/domain/types';
import type { PercentilePoint } from '@/engine/montecarlo/types';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';

interface Props {
  rows: YearRow[];
  markers: MarkerPoint[];
  retireAge: number;
  displayMode: DisplayMode;
  band?: PercentilePoint[];
  range: '10Y' | 'MAX';
  currentAge: number;
  height?: number;
}

function WealthTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value as number | number[] | undefined;
  const balance = get('balance') as number | undefined;
  const p50 = get('p50') as number | undefined;
  const band = get('band') as number[] | undefined;
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">Age {label}</div>
      {balance != null && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
          <span className="text-muted">Projected</span>
          <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(balance)}</span>
        </div>
      )}
      {p50 != null && (
        <div className="mt-1 flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: chart.band }} />
          <span className="text-muted">MC median</span>
          <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(p50)}</span>
        </div>
      )}
      {Array.isArray(band) && (
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          <span className="text-faint">P10–P90</span>
          <span className="ml-auto font-mono tabnum text-muted">
            {fmtUSDAbbrev(band[0])} – {fmtUSDAbbrev(band[1])}
          </span>
        </div>
      )}
    </div>
  );
}

// Lump-sum marker dot with a hover tooltip naming the event and its amount.
// Recharts injects cx/cy when this element is passed as a ReferenceDot `shape`.
function MarkerDot({ cx, cy, label, amount }: { cx?: number; cy?: number; label?: string; amount?: number }) {
  const [hover, setHover] = useState(false);
  if (cx == null || cy == null) return null;

  const amt = amount ?? 0;
  const sign = amt < 0 ? '−' : '+'; // minus sign / plus
  const amountText = `${sign}${fmtUSD(Math.abs(amt))}`;
  const kind = amt < 0 ? 'Lump withdrawal' : 'Lump contribution';

  const TW = 184;
  const TH = 56;
  const flipBelow = cy < TH + 18; // not enough room above — drop the card below the dot
  const ty = flipBelow ? cy + 14 : cy - TH - 14;

  return (
    <g style={{ cursor: 'pointer' }}>
      {/* Native fallback so the value is always discoverable on hover */}
      <title>{`${label}: ${amountText}`}</title>
      {/* Generous transparent hit target */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill="transparent"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <circle cx={cx} cy={cy} r={5} fill={chart.lumpSum} stroke={chart.bgBase} strokeWidth={2} />
      {hover && (
        <foreignObject
          x={cx - TW / 2}
          y={ty}
          width={TW}
          height={TH}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
            <div className="label-mono mb-1.5 truncate">{label}</div>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: chart.lumpSum }} />
              <span className="text-muted">{kind}</span>
              <span className="ml-auto font-mono tabnum text-ink">{amountText}</span>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export function WealthChart({ rows, markers, retireAge, displayMode, band, range, currentAge, height = 300 }: Props) {
  const hasBand = !!band && band.length > 0;
  const data = useMemo(() => {
    const bandByAge = new Map(band?.map((b) => [b.age, b]) ?? []);
    const minAge = range === '10Y' ? currentAge : -Infinity;
    const maxAge = range === '10Y' ? currentAge + 10 : Infinity;
    return rows
      .filter((r) => r.age >= minAge && r.age <= maxAge)
      .map((r) => {
        const balance = displayMode === 'today' ? r.endingBalanceToday : r.endingBalance;
        const b = bandByAge.get(r.age);
        const defl = displayMode === 'today' && b ? b.cpi : 1;
        return {
          age: r.age,
          balance,
          p50: b ? b.p50 / defl : undefined,
          band: b ? [b.p10 / defl, b.p90 / defl] : undefined,
          bandInner: b ? [b.p25 / defl, b.p75 / defl] : undefined,
        };
      });
  }, [rows, band, displayMode, range, currentAge]);

  const markerData = useMemo(() => {
    const within = (a: number) => (range === '10Y' ? a >= currentAge && a <= currentAge + 10 : true);
    return markers
      .filter((m) => within(m.age))
      .map((m) => {
        const row = rows.find((r) => Math.round(r.age) === Math.round(m.age));
        const bal = row ? (displayMode === 'today' ? row.endingBalanceToday : row.endingBalance) : m.balance;
        return { age: Math.round(m.age), balance: bal, label: m.label, amount: m.amount };
      });
  }, [markers, rows, displayMode, range, currentAge]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="wealthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chart.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chart.grid} vertical={false} />
        <XAxis
          dataKey="age"
          type="number"
          domain={['dataMin', 'dataMax']}
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
        <Tooltip content={<WealthTooltip />} />

        {/* Monte Carlo overlay: outer P10–P90, inner P25–P75, median line */}
        {hasBand && (
          <>
            <Area dataKey="band" stroke="none" fill={chart.band} fillOpacity={0.16} connectNulls isAnimationActive={false} />
            <Area dataKey="bandInner" stroke="none" fill={chart.band} fillOpacity={0.26} connectNulls isAnimationActive={false} />
            <Area dataKey="p50" stroke={chart.band} strokeOpacity={0.9} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls isAnimationActive={false} />
          </>
        )}

        {/* Deterministic projection on top */}
        <Area
          type="monotone"
          dataKey="balance"
          stroke={chart.primary}
          strokeWidth={2.5}
          fill={hasBand ? 'none' : 'url(#wealthFill)'}
          dot={false}
          activeDot={{ r: 5, fill: chart.primary, stroke: chart.bgBase, strokeWidth: 2 }}
          isAnimationActive={false}
        />

        <ReferenceLine
          x={retireAge}
          stroke={chart.primary}
          strokeDasharray="4 4"
          label={{ value: 'Retirement', fill: chart.primary, fontFamily: 'Inter Variable', fontSize: 11, position: 'top' }}
        />
        {markerData.map((m, i) => (
          <ReferenceDot
            key={i}
            x={m.age}
            y={m.balance}
            isFront
            shape={<MarkerDot label={m.label} amount={m.amount} />}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
