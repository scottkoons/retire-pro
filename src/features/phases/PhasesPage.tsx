import { useActiveScenario, useStore } from '@/state/store';
import { Section } from '@/components/ui/primitives';
import { Grid, THead, TR, TD, DeleteCell, AddRow, TextInput, NumberInput } from '@/components/grid/Grid';

export default function PhasesPage() {
  const scn = useActiveScenario();
  const s = useStore();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <h1 className="font-head text-head-lg text-ink">Retirement & Return Phases</h1>
        <p className="mt-1 text-[13px] text-muted">Define spending phases and the investment return ramp-down across your retirement.</p>
      </div>

      <Section title="Spending Phases" subtitle="Target monthly income (today's $) over an age window">
        <Grid minWidth={620}>
          <THead
            cols={[
              { label: 'Name', w: '34%' },
              { label: 'Start age', align: 'right' },
              { label: 'End age', align: 'right' },
              { label: 'Target $/mo', align: 'right' },
            ]}
          />
          <tbody>
            {scn.retirementPhases.map((p) => (
              <TR key={p.id} dim={!p.enabled}>
                <TD><TextInput value={p.name} onChange={(v) => s.updateRetirementPhase(p.id, { name: v })} /></TD>
                <TD align="right"><NumberInput value={p.startAge} onChange={(v) => s.updateRetirementPhase(p.id, { startAge: v })} /></TD>
                <TD align="right"><NumberInput value={p.endAge} onChange={(v) => s.updateRetirementPhase(p.id, { endAge: v })} /></TD>
                <TD align="right"><NumberInput value={p.targetMonthlyIncome} prefix="$" onChange={(v) => s.updateRetirementPhase(p.id, { targetMonthlyIncome: v })} /></TD>
                <DeleteCell onClick={() => s.removeRetirementPhase(p.id)} />
              </TR>
            ))}
          </tbody>
          <AddRow colSpan={4} onClick={s.addRetirementPhase} />
        </Grid>
      </Section>

      <Section title="Investment Return Phases" subtitle="Override the global return and volatility by age range (leave empty to use the global return)">
        <Grid minWidth={680}>
          <THead
            cols={[
              { label: 'Name', w: '28%' },
              { label: 'Start age', align: 'right' },
              { label: 'End age', align: 'right' },
              { label: 'Return %', align: 'right' },
              { label: 'Volatility %', align: 'right' },
            ]}
          />
          <tbody>
            {scn.investmentReturnPhases.map((p) => (
              <TR key={p.id} dim={!p.enabled}>
                <TD><TextInput value={p.name} onChange={(v) => s.updateReturnPhase(p.id, { name: v })} /></TD>
                <TD align="right"><NumberInput value={p.startAge} onChange={(v) => s.updateReturnPhase(p.id, { startAge: v })} /></TD>
                <TD align="right"><NumberInput value={p.endAge} onChange={(v) => s.updateReturnPhase(p.id, { endAge: v })} /></TD>
                <TD align="right"><NumberInput value={+(p.expectedReturn * 100).toFixed(1)} suffix="%" onChange={(v) => s.updateReturnPhase(p.id, { expectedReturn: v / 100 })} /></TD>
                <TD align="right"><NumberInput value={+(p.volatility * 100).toFixed(1)} suffix="%" onChange={(v) => s.updateReturnPhase(p.id, { volatility: v / 100 })} /></TD>
                <DeleteCell onClick={() => s.removeReturnPhase(p.id)} />
              </TR>
            ))}
            {scn.investmentReturnPhases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No return phases. The global {(scn.assumptions.annualReturn * 100).toFixed(1)}% return applies to every age.
                </td>
              </tr>
            )}
          </tbody>
          <AddRow colSpan={5} onClick={s.addReturnPhase} />
        </Grid>
      </Section>
    </div>
  );
}
