import { Document, Page, View, Text, StyleSheet, Svg, Path, Line, Circle, G, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { DisplayMode, ProjectionResult, Scenario, Settings } from '@/domain/types';
import type { MonteCarloResult, PercentilePoint } from '@/engine/montecarlo/types';
import { buildPlanSummaryModel, type PlanSummaryModel } from '@/selectors/planSummary';
import { planCheckup } from '@/selectors/checkup';
import { fmtUSD, fmtUSDAbbrev, fmtPct, fmtAgeYM } from '@/lib/format';

const C = {
  text: '#0f172a',
  muted: '#64748b',
  rule: '#e2e8f0',
  orange: '#f97316',
  theadBg: '#f8fafc',
  good: '#16a34a',
  warn: '#d97706',
  bad: '#dc2626',
};

const s = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: C.text, fontFamily: 'Helvetica', fontSize: 9, paddingTop: 32, paddingBottom: 34, paddingHorizontal: 40 },
  eyebrow: { fontFamily: 'Courier', fontSize: 7, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: C.text },
  sub: { fontSize: 9, color: C.muted, marginTop: 2 },
  rule: { height: 2, width: 60, backgroundColor: C.orange, marginVertical: 6 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 10, marginBottom: 4 },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', border: `1pt solid ${C.rule}`, borderRadius: 4, padding: 8 },
  tileLabel: { fontFamily: 'Courier', fontSize: 6.5, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase', marginBottom: 3 },
  tileVal: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  table: { borderTop: `1pt solid ${C.rule}`, marginTop: 4 },
  tr: { flexDirection: 'row', borderBottom: `1pt solid ${C.rule}`, paddingVertical: 3 },
  thead: { backgroundColor: C.theadBg },
  th: { fontFamily: 'Courier', fontSize: 7, color: C.muted, textTransform: 'uppercase', paddingHorizontal: 4 },
  td: { fontSize: 9, paddingHorizontal: 4 },
  tdNum: { fontFamily: 'Courier', fontSize: 8.5, paddingHorizontal: 4, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontFamily: 'Courier', fontSize: 7, color: C.muted },
});

function statusColor(st: ProjectionResult['status']): string {
  return st === 'onTrack' ? C.good : st === 'caution' ? C.warn : C.bad;
}
function statusText(st: ProjectionResult['status']): string {
  return st === 'onTrack' ? 'On Track' : st === 'caution' ? 'Caution' : 'Shortfall';
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileVal}>{value}</Text>
    </View>
  );
}

function Row({ cells, widths, header }: { cells: string[]; widths: number[]; header?: boolean }) {
  return (
    <View style={[s.tr, header ? s.thead : {}]}>
      {cells.map((c, i) => (
        <Text key={i} style={[i === 0 ? (header ? s.th : s.td) : header ? s.th : s.tdNum, { width: `${widths[i]}%` }, i > 0 && !header ? { textAlign: 'right' } : {}]}>
          {c}
        </Text>
      ))}
    </View>
  );
}

function WealthSvg({
  projection,
  displayMode,
  retireAge,
  band,
}: {
  projection: ProjectionResult;
  displayMode: DisplayMode;
  retireAge: number;
  band?: PercentilePoint[];
}) {
  const W = 515;
  const H = 150;
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rows = projection.rows;
  const n = rows.length;
  const valOf = (r: ProjectionResult['rows'][number]) => (displayMode === 'today' ? r.endingBalanceToday : r.endingBalance);
  const vals = rows.map(valOf);
  const bandByAge = new Map((band ?? []).map((b) => [b.age, b]));
  const bandVal = (b: PercentilePoint, key: 'p10' | 'p90') => (displayMode === 'today' ? b[key] / b.cpi : b[key]);

  let max = Math.max(1, ...vals);
  if (band) for (const b of band) max = Math.max(max, bandVal(b, 'p90'));

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (Math.max(0, v) / max) * plotH;
  const retIdx = rows.findIndex((r) => Math.round(r.age) === Math.round(retireAge));

  const linePath = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  let bandPath = '';
  if (band && band.length) {
    const hi = rows.map((r, i) => {
      const b = bandByAge.get(r.age);
      return `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b ? bandVal(b, 'p90') : valOf(r)).toFixed(1)}`;
    });
    const lo = rows
      .map((r, i) => ({ r, i }))
      .reverse()
      .map(({ r, i }) => {
        const b = bandByAge.get(r.age);
        return `L${x(i).toFixed(1)},${y(b ? bandVal(b, 'p10') : valOf(r)).toFixed(1)}`;
      });
    bandPath = `${hi.join(' ')} ${lo.join(' ')} Z`;
  }

  const yticks = [0, 1, 2, 3].map((k) => max * (k / 3));
  const xticks: { i: number; t: string; anchor: 'start' | 'middle' | 'end' }[] = [
    { i: 0, t: `Age ${rows[0].age}`, anchor: 'start' },
  ];
  if (retIdx > 0 && retIdx < n - 1) xticks.push({ i: retIdx, t: `Age ${Math.round(retireAge)}`, anchor: 'middle' });
  xticks.push({ i: n - 1, t: `Age ${rows[n - 1].age}`, anchor: 'end' });

  return (
    <Svg width={W} height={H} style={{ marginTop: 4 }}>
      {/* gridlines + dollar labels */}
      {yticks.map((v, idx) => (
        <G key={idx}>
          <Line x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)} strokeWidth={0.5} stroke={C.rule} />
          <Text x={padL - 4} y={y(v) + 2} fill={C.muted} textAnchor="end" style={{ fontFamily: 'Courier', fontSize: 6 }}>
            {fmtUSDAbbrev(v)}
          </Text>
        </G>
      ))}

      {/* Monte Carlo P10–P90 band */}
      {bandPath !== '' && <Path d={bandPath} fill="#38bdf8" fillOpacity={0.16} />}

      {/* deterministic projection */}
      <Path d={areaPath} fill={C.orange} fillOpacity={0.1} />
      <Path d={linePath} stroke={C.orange} strokeWidth={1.5} fill="none" />

      {/* retirement marker + value callout */}
      {retIdx > 0 && (
        <G>
          {/* react-pdf parses dash arrays comma-separated; "2 2" becomes NaN and throws. */}
          <Line x1={x(retIdx)} y1={padT} x2={x(retIdx)} y2={padT + plotH} stroke={C.orange} strokeWidth={0.6} strokeDasharray="2,2" />
          <Circle cx={x(retIdx)} cy={y(vals[retIdx])} r={2.4} fill={C.orange} />
          <Text x={x(retIdx)} y={y(vals[retIdx]) - 4} fill={C.text} textAnchor="middle" style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }}>
            {fmtUSDAbbrev(vals[retIdx])}
          </Text>
        </G>
      )}

      {/* ending value callout */}
      <Text x={x(n - 1)} y={y(vals[n - 1]) - 4} fill={C.text} textAnchor="end" style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }}>
        {fmtUSDAbbrev(vals[n - 1])}
      </Text>

      {/* age labels */}
      {xticks.map((t, idx) => (
        <Text key={idx} x={x(t.i)} y={H - 4} fill={C.muted} textAnchor={t.anchor} style={{ fontFamily: 'Courier', fontSize: 6 }}>
          {t.t}
        </Text>
      ))}
    </Svg>
  );
}

function hasV2(p: ProjectionResult): boolean {
  return p.rows.some((r) => r.netWorth != null);
}

function V2Page({
  projection,
  scenario,
  settings,
  displayMode,
  household,
  generatedOn,
  mcSuccess,
}: {
  projection: ProjectionResult;
  scenario: Scenario;
  settings?: Settings;
  displayMode: DisplayMode;
  household: string;
  generatedOn: string;
  mcSuccess?: number;
}) {
  const rows = projection.rows;
  const nwVal = (r: ProjectionResult['rows'][number]) => (displayMode === 'today' ? r.netWorthToday ?? 0 : r.netWorth ?? 0);
  const peak = Math.max(0, ...rows.map(nwVal));
  const peakRow = rows.find((r) => nwVal(r) === peak);
  const retAge = Math.round(scenario.assumptions.retirementAge);
  const atRet = rows.find((r) => r.age >= retAge);
  const last = rows[rows.length - 1];
  const lifetimeTax = rows.reduce((sum, r) => sum + (r.totalTax ?? 0) + (r.irmaa ?? 0), 0);
  const peakEff = Math.max(0, ...rows.map((r) => r.effectiveRate ?? 0));
  const peakEquity = Math.max(0, ...rows.map((r) => (displayMode === 'today' ? (r.homeEquity ?? 0) / r.cpiFactor : r.homeEquity ?? 0)));

  const taxRows = rows.filter((r) => r.age >= retAge && (r.age - retAge) % 5 === 0);
  const insights = settings ? planCheckup({ rows, result: projection, scn: scenario, settings, mcSuccess }) : [];

  return (
    <Page size="LETTER" style={s.page}>
      <Text style={s.eyebrow}>Net Worth, Taxes & Checkup</Text>
      <Text style={s.h1}>{scenario.name}</Text>
      <Text style={s.sub}>
        {household} · {generatedOn} · {displayMode === 'today' ? "Today's $" : 'Actual $'}
      </Text>
      <View style={s.rule} />

      <Text style={s.sectionTitle}>Net Worth & Lifetime Tax</Text>
      <View style={s.tileRow}>
        <Tile label="Peak Net Worth" value={`${fmtUSD(peak)}${peakRow ? ` @ ${peakRow.age}` : ''}`} />
        <Tile label={`At Retirement (${retAge})`} value={fmtUSD(atRet ? nwVal(atRet) : 0)} />
        <Tile label={`Ending (${last?.age ?? ''})`} value={fmtUSD(last ? nwVal(last) : 0)} />
        <Tile label="Lifetime Tax (nominal)" value={fmtUSD(lifetimeTax)} />
        <Tile label="Peak Effective Rate" value={fmtPct(peakEff)} />
        <Tile label="Peak Home Equity" value={fmtUSD(peakEquity)} />
      </View>

      <Text style={s.sectionTitle}>Taxes by Age (every 5 years)</Text>
      <View style={s.table}>
        <Row header widths={[16, 21, 15, 16, 16, 16]} cells={['Age', 'Total Tax', 'Eff %', 'IRMAA', 'RMD', 'MAGI']} />
        {taxRows.map((r, i) => (
          <Row
            key={i}
            widths={[16, 21, 15, 16, 16, 16]}
            cells={[String(r.age), fmtUSD(r.totalTax ?? 0), fmtPct(r.effectiveRate ?? 0), fmtUSD(r.irmaa ?? 0), fmtUSD(r.rmd ?? 0), fmtUSDAbbrev(r.magi ?? 0)]}
          />
        ))}
      </View>

      {insights.length > 0 && (
        <View>
          <Text style={s.sectionTitle}>Plan Checkup</Text>
          {insights.map((ins, i) => (
            <View key={i} style={{ marginBottom: 5 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: ins.severity === 'warning' ? C.bad : ins.severity === 'caution' ? C.warn : C.text }}>
                {ins.severity === 'warning' ? '⚠ ' : ''}
                {ins.title}
              </Text>
              <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 1 }}>{ins.detail}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[s.sub, { marginTop: 10 }]}>
        Tax estimates use 2025 federal MFJ and Colorado rules indexed to inflation; IRMAA is a Medicare surcharge, not income tax. Illustrative only, not tax advice.
      </Text>

      <View style={s.footer} fixed>
        <Text style={s.footText}>RetirePro · {scenario.name} · {generatedOn}</Text>
        <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function PlanSummaryPdf({
  model,
  projection,
  mc,
  scenario,
  settings,
}: {
  model: PlanSummaryModel;
  projection: ProjectionResult;
  mc: MonteCarloResult | null;
  scenario: Scenario;
  settings?: Settings;
}) {
  const k = model.keyResults;
  const a = model.assumptions;
  return (
    <Document title={`RetirePro Plan Summary — ${model.scenarioName}`} author="RetirePro">
      <Page size="LETTER" style={s.page}>
        <Text style={s.eyebrow}>Retirement Plan Summary</Text>
        <Text style={s.h1}>{model.scenarioName}</Text>
        <Text style={s.sub}>
          {model.household} · {model.generatedOn} · {model.displayMode === 'today' ? "Today's $" : 'Actual $'}
        </Text>
        <View style={s.rule} />

        <Text style={s.sectionTitle}>Key Projected Results</Text>
        <View style={s.tileRow}>
          <Tile label="Balance at Retirement" value={fmtUSD(k.balanceAtRetirement)} />
          <Tile label="Monthly Income" value={fmtUSD(k.monthlyIncome)} />
          <Tile label="Annual Income" value={fmtUSD(k.annualIncome)} />
          <Tile label="Guaranteed / mo" value={fmtUSD(k.guaranteedMonthly)} />
          <Tile label="Portfolio Draw / mo" value={fmtUSD(k.requiredWithdrawal)} />
          <View style={s.tile}>
            <Text style={s.tileLabel}>Status</Text>
            <Text style={[s.tileVal, { color: statusColor(k.status) }]}>{statusText(k.status)}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Assumptions</Text>
        <View style={s.tileRow}>
          <Tile label="Current Age" value={fmtAgeYM(a.currentAge)} />
          <Tile label="Retirement Age" value={fmtAgeYM(a.retireAge)} />
          <Tile label="Model End Age" value={fmtAgeYM(a.modelEndAge)} />
          <Tile label="Annual Return" value={fmtPct(a.annualReturn)} />
          <Tile label="Inflation" value={fmtPct(a.inflation)} />
          <Tile label="Starting Balance" value={fmtUSD(a.startingBalance)} />
        </View>
        <Text style={[s.sub, { marginTop: 6 }]}>Withdrawal: {a.withdrawal}</Text>

        <Text style={s.sectionTitle}>Projected Wealth Growth</Text>
        <WealthSvg projection={projection} displayMode={model.displayMode} retireAge={a.retireAge} band={mc ? mc.percentileSeries : undefined} />

        <Text style={s.sectionTitle}>Income Streams</Text>
        <View style={s.table}>
          <Row header widths={[34, 18, 12, 12, 12, 12]} cells={['Source', 'Today $/mo', 'Start', 'End', 'COLA', `@${Math.round(a.retireAge)}`]} />
          {model.incomeStreams.map((st, i) => (
            <Row key={i} widths={[34, 18, 12, 12, 12, 12]} cells={[st.name, fmtUSD(st.today), fmtAgeYM(st.start), fmtAgeYM(st.end), fmtPct(st.cola), fmtUSD(st.atRetire)]} />
          ))}
        </View>

        <Text style={s.sectionTitle}>Lump Sum Events</Text>
        <View style={s.table}>
          <Row header widths={[60, 20, 20]} cells={['Event', 'Age', 'Amount']} />
          {model.lumpSums.map((l, i) => (
            <Row key={i} widths={[60, 20, 20]} cells={[l.name, fmtAgeYM(l.age), fmtUSD(l.amount)]} />
          ))}
        </View>

        <Text style={s.sectionTitle}>Monthly Contributions</Text>
        <View style={s.table}>
          <Row header widths={[34, 16, 16, 16, 18]} cells={['Name', 'Monthly', 'Months', 'Start', 'Total']} />
          {model.contributions.map((c, i) => (
            <Row key={i} widths={[34, 16, 16, 16, 18]} cells={[c.name, fmtUSD(c.monthly), String(c.months), fmtAgeYM(c.start), fmtUSD(c.total)]} />
          ))}
        </View>

        <View>
          <Text style={s.sectionTitle}>Spending Phases</Text>
          <View style={s.table}>
            <Row header widths={[40, 20, 20, 20]} cells={['Phase', 'Start', 'End', 'Target $/mo']} />
            {model.spendingPhases.map((p, i) => (
              <Row key={i} widths={[40, 20, 20, 20]} cells={[p.name, fmtAgeYM(p.start), fmtAgeYM(p.end), fmtUSD(p.target)]} />
            ))}
          </View>

          {model.monteCarlo.ran && (
            <View>
              <Text style={s.sectionTitle}>Monte Carlo Results</Text>
              <View style={s.table}>
                <Row header widths={[60, 40]} cells={['Metric', 'Value']} />
                <Row widths={[60, 40]} cells={['Simulations', model.monteCarlo.paths.toLocaleString()]} />
                <Row widths={[60, 40]} cells={['Success probability', fmtPct(model.monteCarlo.success, 0)]} />
                <Row widths={[60, 40]} cells={['Ending P10 (today $)', fmtUSD(model.monteCarlo.p10)]} />
                <Row widths={[60, 40]} cells={['Ending P50 (today $)', fmtUSD(model.monteCarlo.p50)]} />
                <Row widths={[60, 40]} cells={['Ending P90 (today $)', fmtUSD(model.monteCarlo.p90)]} />
                <Row widths={[60, 40]} cells={['Median failure age', model.monteCarlo.medianFailureAge != null ? fmtAgeYM(model.monteCarlo.medianFailureAge) : 'none']} />
              </View>
            </View>
          )}

          <Text style={[s.sub, { marginTop: 10 }]}>
            Illustrative projection only, not financial advice. Today's $ removes inflation; returns are modeled as lognormal annual draws.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>RetirePro · {model.scenarioName} · {model.generatedOn}</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {hasV2(projection) && (
        <V2Page
          projection={projection}
          scenario={scenario}
          settings={settings}
          displayMode={model.displayMode}
          household={model.household}
          generatedOn={model.generatedOn}
          mcSuccess={mc?.successProbability}
        />
      )}
    </Document>
  );
}

export interface ExportArgs {
  scenario: Scenario;
  projection: ProjectionResult;
  displayMode: DisplayMode;
  household: string;
  settings?: Settings;
  monteCarlo?: MonteCarloResult;
  includeMonteCarlo?: boolean;
}

export async function exportPlanSummaryPdf(args: ExportArgs): Promise<void> {
  const includeMc = args.includeMonteCarlo ?? !!args.monteCarlo;
  const mc = includeMc ? args.monteCarlo ?? null : null;
  const model = buildPlanSummaryModel(args.scenario, args.projection, mc, args.displayMode, args.household);
  const blob = await pdf(
    <PlanSummaryPdf model={model} projection={args.projection} mc={mc} scenario={args.scenario} settings={args.settings} />,
  ).toBlob();
  const date = new Date().toISOString().slice(0, 10);
  const safe = args.scenario.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'Scenario';
  saveAs(blob, `RetirePro_Plan_${safe}_${date}.pdf`);
}
