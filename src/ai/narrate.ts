// ============================================================================
// Plan narrator — turns the projection into plain English.
//
// The division of labour is deliberate and load-bearing: the ENGINE owns every
// number, the model owns only the words. The model is handed the finished
// PlanSummaryModel (the same object the Summary page and the PDF render) and is
// instructed never to derive a figure of its own. A retirement planner that
// confidently states a hallucinated balance is worse than one that says nothing,
// so nothing here is allowed to do arithmetic.
// ============================================================================

import type { PlanSummaryModel } from '@/selectors/planSummary';
import { createAiClient } from './client';
import type { AiConfig } from './config';

const SYSTEM = [
  'You are explaining a retirement projection to the person whose plan it is.',
  '',
  'The JSON you are given is the complete output of a deterministic projection engine.',
  'It is the only source of truth you have and the only source you may use.',
  '',
  'Rules:',
  '- Never calculate, estimate, or invent a number. You may quote figures that appear in the JSON and compare them to each other, but you must not perform arithmetic to produce any new figure, including totals, differences, percentages, or ratios.',
  '- If something is absent from the JSON, say plainly that it is not modeled. Never fill a gap with an assumption.',
  '- Do not recommend specific investments, products, or allocations. Describe what this model shows and what it depends on.',
  '',
  'Write exactly three short paragraphs of prose. No headings, no bullet points, no markdown, no preamble.',
  '1. What this plan does: when they stop working, what they retire on, and where that income comes from.',
  '2. What the outcome hinges on: the one or two inputs this result is most sensitive to.',
  '3. What is worth watching: the nearest risk or fragility that is visible in the data.',
  '',
  'Address the reader as "you". Be direct and concrete.',
  'Avoid contractions. Do not use em-dashes or hyphens as dashes; use commas or restructure the sentence.',
].join('\n');

export async function narratePlan(cfg: AiConfig, summary: PlanSummaryModel): Promise<string> {
  const client = await createAiClient(cfg);
  const dollars =
    summary.displayMode === 'today'
      ? "All dollar amounts are in TODAY'S dollars, already adjusted for inflation."
      : 'All dollar amounts are in ACTUAL future dollars, not adjusted for inflation.';

  return client.generateText({
    system: SYSTEM,
    maxTokens: 900,
    prompt: [
      dollars,
      summary.monteCarlo.ran
        ? 'A Monte Carlo simulation has been run; its results are included.'
        : 'Monte Carlo has not been run for this scenario, so no success probability is available. Do not speculate about one.',
      '',
      'Projection:',
      JSON.stringify(summary, null, 1),
    ].join('\n'),
  });
}
