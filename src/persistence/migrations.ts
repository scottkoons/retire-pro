import { SCHEMA_VERSION } from './constants';
import { newId } from '@/domain/ids';
import {
  defaultBusinessVenture,
  defaultInheritance,
  defaultLongTermCare,
  emptyHomePlan,
  neutralHealthcare,
} from '@/domain/defaults';

type AnyDoc = Record<string, unknown> & { schemaVersion?: number };
type Migration = (doc: AnyDoc) => AnyDoc;

// Build SS claiming config from legacy SS income streams; enabled:false keeps the
// legacy streams driving income so migrated docs project identically.
function ssConfigFromStreams(streams: unknown[]): unknown {
  const arr = Array.isArray(streams) ? (streams as Array<Record<string, unknown>>) : [];
  const find = (owner: string) => arr.find((s) => s.owner === owner && /social security/i.test(String(s.name ?? '')));
  const mk = (owner: 'self' | 'spouse') => {
    const s = find(owner);
    return {
      owner,
      enabled: true,
      benefitAtFRA: typeof s?.monthlyAmountToday === 'number' ? s.monthlyAmountToday : owner === 'self' ? 2_800 : 2_200,
      fra: 67,
      claimAge: typeof s?.startAge === 'number' ? s.startAge : 67,
      cola: typeof s?.cola === 'number' ? s.cola : 0.025,
    };
  };
  return { enabled: false, claims: [mk('self'), mk('spouse')] };
}

function migrateScenarioV1toV2(scn: Record<string, unknown>): Record<string, unknown> {
  const assumptions = (scn.assumptions ?? {}) as Record<string, unknown>;
  const start = Number(assumptions.startingBalance ?? 0);
  const accounts = [
    {
      id: newId(),
      name: 'Taxable brokerage',
      kind: 'taxable' as const,
      balance: start,
      costBasisRatio: 0.5,
      enabled: true,
      contributionTarget: false,
      notes: 'Migrated from v1 starting balance — edit and add real accounts',
    },
    {
      id: newId(),
      name: 'Pre-tax 401(k)',
      kind: 'pretax' as const,
      balance: 0,
      owner: 'self' as const,
      enabled: true,
      contributionTarget: true,
    },
  ];
  return {
    ...scn,
    accounts,
    expenses: [],
    home: emptyHomePlan(), // neutral; v1 docs had no home modeling
    socialSecurity: ssConfigFromStreams((scn.incomeStreams as unknown[]) ?? []),
    healthcare: neutralHealthcare(), // off; no new costs post-migration
    longTermCare: defaultLongTermCare(),
    inheritance: defaultInheritance(),
    businessVenture: defaultBusinessVenture(),
    withdrawalSequence: ['taxable', 'pretax', 'roth'],
    spendingMode: 'phase-target', // preserve v1 behavior until the user opts into expense-driven planning
    assumptions: {
      ...assumptions,
      birthMonth: typeof assumptions.birthMonth === 'number' ? assumptions.birthMonth : 0,
      birthDay: typeof assumptions.birthDay === 'number' ? assumptions.birthDay : 1,
      spouseAgeOffset: (assumptions.spouseAgeOffset as number | undefined) ?? 0,
    },
  };
}

// migrations[i] lifts version i -> i+1. Append-only. Docs in the wild are v1, so the
// v1 -> v2 step lives at index 1 (the loop calls migrations[v] with v=1).
const migrations: Migration[] = [
  // index 0: v0 -> v1 (never shipped)
  undefined as unknown as Migration,
  // index 1: v1 -> v2
  (doc) => ({
    ...doc,
    scenarios: Array.isArray(doc.scenarios)
      ? (doc.scenarios as Array<Record<string, unknown>>).map(migrateScenarioV1toV2)
      : doc.scenarios,
    settings: {
      ...((doc.settings as object) ?? {}),
      defaultWithdrawalSequence: ['taxable', 'pretax', 'roth'],
      defaultCostBasisRatio: 0.5,
      rmdStartAge: 73,
    },
  }),
  // index 2: v2 -> v3 (date anchor honours the birthday day)
  (doc) => ({
    ...doc,
    scenarios: Array.isArray(doc.scenarios)
      ? (doc.scenarios as Array<Record<string, unknown>>).map(freezeDisplayedDates)
      : doc.scenarios,
  }),
];

/**
 * v2 -> v3: the date anchor changed (dateToMonthIndex now honours the birthday
 * day; isoFromAge now shows the 1st that falls inside an age month). Every
 * age-only contribution end and lump sum was DISPLAYED as a calendar month in
 * the Planner, and the user planned around those labels (e.g. one row ending
 * September, the next starting October). Leaving them age-based would change
 * their labels and open gaps against typed neighbours, so each one is frozen
 * to the exact month the OLD display showed. The whole plan then reads as it
 * did before and every dated flow moves onto the corrected grid together.
 * Undated rows (no age) are left untouched.
 */
function freezeDisplayedDates(scn: Record<string, unknown>): Record<string, unknown> {
  const a = (scn.assumptions ?? {}) as Record<string, unknown>;
  const by = Number(a.birthYear);
  const bm = Number(a.birthMonth);
  if (!Number.isFinite(by) || !Number.isFinite(bm)) return scn;
  // The pre-v3 isoFromAge, reproduced here so this step never drifts with the live helper.
  const oldLabel = (age: number) => {
    const whole = Math.floor(age);
    const d = new Date(by + whole, bm + Math.round((age - whole) * 12), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const has = (v: unknown) => typeof v === 'string' && v !== '';
  const contributions = Array.isArray(scn.contributions)
    ? (scn.contributions as Array<Record<string, unknown>>).map((c) => {
        const out = { ...c };
        if (!has(c.startDateOverride) && typeof c.startAge === 'number') out.startDateOverride = oldLabel(c.startAge);
        if (!has(c.endDateOverride) && typeof c.endAge === 'number') out.endDateOverride = oldLabel(c.endAge);
        return out;
      })
    : scn.contributions;
  const lumpSums = Array.isArray(scn.lumpSums)
    ? (scn.lumpSums as Array<Record<string, unknown>>).map((l) =>
        !has(l.dateOverride) && typeof l.age === 'number' ? { ...l, dateOverride: oldLabel(l.age) } : l,
      )
    : scn.lumpSums;
  return { ...scn, contributions, lumpSums };
}

export function migrate(raw: AnyDoc): AnyDoc {
  let doc = raw;
  // Only the v1 format ever shipped, so treat a missing version as v1 (route it through
  // v1->v2) rather than dropping it to the seed.
  let v = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  while (v < SCHEMA_VERSION) {
    const step = migrations[v];
    if (!step) break;
    doc = step(doc);
    v += 1;
    doc.schemaVersion = v;
  }
  return doc;
}
