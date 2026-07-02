import { useMemo } from 'react';
import { Sankey, Tooltip, Rectangle, Layer, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { YearRow } from '@/domain/types';
import { chart } from '@/theme/tokens';
import { fmtUSD, fmtUSDAbbrev } from '@/lib/format';

// Node index map for the fixed left -> middle -> right flow graph.
// Indices are referenced directly when building links, so order matters.
const NODES = [
  'Guaranteed Income', // 0  source
  'Portfolio Withdrawals', // 1  source
  'Gross Cash', // 2  hub
  'Income Taxes', // 3  sink
  'IRMAA', // 4  sink
  'Housing', // 5  sink
  'Healthcare', // 6  sink
  'Living/Travel', // 7  sink
  'Net Spendable', // 8  sink
] as const;

// Per-node fill: sources warm, hub primary, sinks from the categorical palette.
const NODE_COLOR: Record<number, string> = {
  0: chart.success, // guaranteed income
  1: chart.cat[1], // withdrawals (violet)
  2: chart.primary, // gross cash hub
  3: chart.error, // income taxes
  4: chart.cat[2], // IRMAA (pink)
  5: chart.cat[5], // housing (blue)
  6: chart.cat[3], // healthcare (green)
  7: chart.cat[4], // living/travel (amber)
  8: chart.cat[6], // net spendable (orange)
};

function SankeyTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as
    | { name?: string; value?: number; source?: { name?: string }; target?: { name?: string } }
    | undefined;
  if (!p) return null;
  // Recharts passes either a node payload (has .name) or a link payload (has .source/.target).
  const isLink = !!p.source && !!p.target;
  const title = isLink ? `${p.source?.name} → ${p.target?.name}` : p.name ?? '';
  const value = p.value ?? 0;
  return (
    <div className="rounded-lg border border-border-strong bg-card-high px-3 py-2 shadow-overlay">
      <div className="label-mono mb-1.5">{title}</div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="h-2 w-2 rounded-full" style={{ background: chart.primary }} />
        <span className="text-muted">Flow</span>
        <span className="ml-auto font-mono tabnum text-ink">{fmtUSD(value)}</span>
      </div>
    </div>
  );
}

// Custom node: a colored rectangle plus a name + abbreviated-value label.
// Recharts injects geometry (x/y/width/height), payload, and chart dimensions.
function SankeyNode({
  x,
  y,
  width,
  height,
  index,
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name?: string; value?: number; idx?: number };
}) {
  if (x == null || y == null || width == null || height == null) return null;
  const i = index ?? 0;
  // `idx` is the node's ORIGINAL index (preserved through link compaction) so colors
  // and the sink/right-column test stay correct after orphan nodes are dropped.
  const orig = payload?.idx ?? i;
  const color = NODE_COLOR[orig] ?? chart.cat[5];
  const name = payload?.name ?? '';
  const value = payload?.value ?? 0;
  // Sinks (original indices 3-8) sit in the right column, so flip their labels inward.
  const isRightEdge = orig >= 3;
  const labelX = isRightEdge ? x - 6 : x + width + 6;
  const anchor = isRightEdge ? 'end' : 'start';
  const midY = y + height / 2;
  return (
    <Layer key={`node-${i}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} radius={2} />
      <text
        x={labelX}
        y={midY - 5}
        textAnchor={anchor}
        fontFamily="Inter Variable"
        fontSize={11}
        fill={chart.axis}
      >
        {name}
      </text>
      <text
        x={labelX}
        y={midY + 9}
        textAnchor={anchor}
        fontFamily="Inter Variable"
        fontSize={11}
        fill="#e2e8f0"
      >
        {fmtUSDAbbrev(value)}
      </text>
    </Layer>
  );
}

export function CashFlowSankey({ row, height = 380 }: { row: YearRow; height?: number }) {
  const graph = useMemo(() => {
    const ec = row.expensesByCategory;
    // Living/Travel bucket aggregates several discretionary + LTC categories.
    const livingTravel =
      (ec?.living ?? 0) +
      (ec?.travel ?? 0) +
      (ec?.other ?? 0) +
      (ec?.club ?? 0) +
      (ec?.longTermCare ?? 0);

    // Candidate links keyed by node index; Recharts THROWS on value <= 0, so filter.
    const candidates: { source: number; target: number; value: number }[] = [
      { source: 0, target: 2, value: row.guaranteedIncome }, // Guaranteed Income -> Gross Cash
      { source: 1, target: 2, value: row.withdrawals ?? 0 }, // Portfolio Withdrawals -> Gross Cash
      { source: 2, target: 3, value: row.totalTax ?? 0 }, // Gross Cash -> Income Taxes
      { source: 2, target: 4, value: row.irmaa ?? 0 }, // Gross Cash -> IRMAA
      { source: 2, target: 5, value: ec?.housing ?? 0 }, // Gross Cash -> Housing
      { source: 2, target: 6, value: ec?.healthcare ?? 0 }, // Gross Cash -> Healthcare
      { source: 2, target: 7, value: livingTravel }, // Gross Cash -> Living/Travel
      { source: 2, target: 8, value: Math.max(0, row.netSpendable ?? 0) }, // Gross Cash -> Net Spendable
    ];

    const links0 = candidates.filter((l) => l.value > 0);
    // Compact to only nodes actually referenced by a surviving link so Recharts never
    // sees an orphaned (disconnected) node, which would render a stray zero-height label.
    const used = [...new Set(links0.flatMap((l) => [l.source, l.target]))].sort((a, b) => a - b);
    const remap = new Map(used.map((orig, idx) => [orig, idx]));
    const nodes = used.map((orig) => ({ name: NODES[orig], idx: orig }));
    const links = links0.map((l) => ({ source: remap.get(l.source)!, target: remap.get(l.target)!, value: l.value }));
    return { nodes, links };
  }, [row]);

  // Sankey needs at least two valid links plus a connected hub; otherwise render a clean empty state.
  if (graph.links.length < 2) {
    return (
      <div className="flex items-center justify-center text-muted text-[13px]" style={{ height }}>
        No cash-flow detail for this year.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={graph}
        nodePadding={24}
        node={<SankeyNode />}
        link={{ stroke: chart.cat[5], strokeOpacity: 0.25 }}
        margin={{ top: 8, right: 120, bottom: 8, left: 8 }}
      >
        <Tooltip content={<SankeyTooltip />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
