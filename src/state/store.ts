import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Account,
  AccountKind,
  BusinessVentureConfig,
  DisplayMode,
  ExpenseCategory,
  ExpenseItem,
  ExtraPrincipalPayment,
  HealthcareConfig,
  HomePlan,
  InheritanceConfig,
  InvestmentReturnPhase,
  IncomeStream,
  Loan,
  LoanKind,
  LongTermCareConfig,
  LumpSumEvent,
  MonthlyContribution,
  NetWorthCategory,
  NetWorthItem,
  NetWorthSnapshot,
  Owner,
  PersistedDocument,
  PresetKey,
  RetirementPhase,
  Scenario,
  ScenarioAssumptions,
  Settings,
  SocialSecurityClaim,
  SocialSecurityConfig,
  SpendingMode,
  UiState,
  WithdrawalStrategy,
} from '@/domain/types';
import { newId } from '@/domain/ids';
import { applyPreset, cloneScenario, PRESETS } from '@/domain/presets';
import {
  emptyHomePlan,
  neutralHealthcare,
  defaultLongTermCare,
  defaultInheritance,
  defaultBusinessVenture,
  defaultSocialSecurity,
} from '@/domain/defaults';
import { loadDocument, saveDocument } from '@/persistence/storage';
import { AUTOSAVE_DEBOUNCE_MS } from '@/persistence/constants';
import { ageFromBirthDate } from '@/lib/dates';
import { isLegacySsStream } from '@/engine/project';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StoreState extends PersistedDocument {
  ui: UiState;
  saveStatus: SaveStatus;
  saveError?: string;
  recovered?: string;

  // scenario management
  selectScenario: (id: string) => void;
  createFromPreset: (key: PresetKey) => void;
  createBlank: () => void;
  duplicateActive: () => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;

  // active scenario edits
  setAssumption: <K extends keyof ScenarioAssumptions>(key: K, value: ScenarioAssumptions[K]) => void;
  setBirthDate: (isoDate: string) => void;
  setWithdrawal: (patch: Partial<WithdrawalStrategy>) => void;

  addContribution: () => void;
  updateContribution: (id: string, patch: Partial<MonthlyContribution>) => void;
  removeContribution: (id: string) => void;

  addLumpSum: () => void;
  updateLumpSum: (id: string, patch: Partial<LumpSumEvent>) => void;
  removeLumpSum: (id: string) => void;

  addIncomeStream: () => void;
  updateIncomeStream: (id: string, patch: Partial<IncomeStream>) => void;
  removeIncomeStream: (id: string) => void;

  addRetirementPhase: () => void;
  updateRetirementPhase: (id: string, patch: Partial<RetirementPhase>) => void;
  removeRetirementPhase: (id: string) => void;

  addReturnPhase: () => void;
  updateReturnPhase: (id: string, patch: Partial<InvestmentReturnPhase>) => void;
  removeReturnPhase: (id: string) => void;

  // v2 accounts
  addAccount: (kind?: AccountKind, name?: string) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  setContributionTarget: (id: string) => void;
  reorderWithdrawalSequence: (seq: AccountKind[]) => void;

  // v2 expenses
  addExpense: (category?: ExpenseCategory) => void;
  updateExpense: (id: string, patch: Partial<ExpenseItem>) => void;
  removeExpense: (id: string) => void;

  // v2 config blocks
  updateHome: (patch: Partial<HomePlan>) => void;
  addExtraPrincipal: () => void;
  updateExtraPrincipal: (id: string, patch: Partial<ExtraPrincipalPayment>) => void;
  removeExtraPrincipal: (id: string) => void;
  addLoan: (kind?: LoanKind) => void;
  updateLoan: (id: string, patch: Partial<Loan>) => void;
  removeLoan: (id: string) => void;
  updateSocialSecurity: (patch: Partial<SocialSecurityConfig>) => void;
  updateSsClaim: (owner: Owner, patch: Partial<SocialSecurityClaim>) => void;
  setSsPlannerEnabled: (on: boolean) => void;
  updateHealthcare: (patch: Partial<HealthcareConfig>) => void;
  updateLongTermCare: (patch: Partial<LongTermCareConfig>) => void;
  updateInheritance: (patch: Partial<InheritanceConfig>) => void;
  updateBusinessVenture: (patch: Partial<BusinessVentureConfig>) => void;
  setSpendingMode: (mode: SpendingMode) => void;

  // household net worth statement (document-level, not per-scenario)
  addNetWorthItem: (category: NetWorthCategory, liability?: boolean) => void;
  updateNetWorthItem: (id: string, patch: Partial<NetWorthItem>) => void;
  removeNetWorthItem: (id: string) => void;
  saveNetWorthSnapshot: (snap: NetWorthSnapshot) => void;

  // settings / ui
  updateSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setDisplayModeOverride: (mode: DisplayMode | null) => void;
  setChartRange: (r: '10Y' | 'MAX') => void;
  toggleMcBand: (on?: boolean) => void;
  toggleSidebar: (on?: boolean) => void;
  toggleRail: (on?: boolean) => void;

  // document-level
  replaceDocument: (doc: PersistedDocument) => void;
}

// Current age is DERIVED from each scenario's birth date so the plan's anchor
// never drifts as months pass (the stored currentAge is refreshed on load).
function deriveCurrentAges(doc: PersistedDocument): PersistedDocument {
  for (const scn of doc.scenarios) {
    const a = scn.assumptions;
    a.currentAge = ageFromBirthDate(a.birthYear, a.birthMonth, a.birthDay);
  }
  return doc;
}

// Self-heal any scenario where the SS claim-age planner is on but its linked
// legacy income row is still marked enabled (a stale toggle, a hand-edited
// backup). The engine already refuses to double-count regardless (see
// streamNominalAt in engine/project.ts) — this just keeps the Planner Sheet's
// own display in sync with what is actually being projected.
function reconcileSsPlanner(doc: PersistedDocument): PersistedDocument {
  for (const scn of doc.scenarios) {
    if (!scn.socialSecurity?.enabled) continue;
    for (const st of scn.incomeStreams) {
      if (isLegacySsStream(st) && st.enabled) {
        st.enabled = false;
        st.isSocialSecurity = true;
      }
    }
  }
  return doc;
}

// Accounts are HOUSEHOLD facts (current balances), not per-scenario assumptions:
// the same money exists no matter which future is modeled. The ACTIVE scenario's
// list is authoritative; mirror it to every scenario and keep each scenario's
// legacy startingBalance in sync so every projection starts from the same total.
function mirrorAccountsFromActive(doc: PersistedDocument): PersistedDocument {
  const active = doc.scenarios.find((x) => x.id === doc.activeScenarioId) ?? doc.scenarios[0];
  if (!active) return doc;
  for (const scn of doc.scenarios) {
    if (scn !== active) scn.accounts = JSON.parse(JSON.stringify(active.accounts));
    scn.assumptions.startingBalance = scn.accounts
      .filter((a) => a.enabled)
      .reduce((sum, a) => sum + a.balance, 0);
  }
  return doc;
}

const init = loadDocument();
deriveCurrentAges(init.doc);
mirrorAccountsFromActive(init.doc);
reconcileSsPlanner(init.doc);
const nowISO = () => new Date().toISOString();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<StoreState>()(
  immer((set, get) => {
    // Account edits apply to the ACTIVE scenario, then mirror to every scenario:
    // accounts are household facts (the same money exists in every modeled future),
    // so the Starting Amount is identical regardless of which scenario is open.
    // Each scenario's legacy startingBalance mirror is kept in lockstep so the
    // summary, PDF export, and projections all agree with the accounts total.
    const mutateAccounts = (fn: (scn: Scenario) => void) => {
      set((s) => {
        const active = s.scenarios.find((x) => x.id === s.activeScenarioId);
        if (!active) return;
        fn(active);
        active.updatedAt = nowISO();
        for (const scn of s.scenarios) {
          if (scn !== active) scn.accounts = JSON.parse(JSON.stringify(active.accounts));
          scn.assumptions.startingBalance = scn.accounts
            .filter((a) => a.enabled)
            .reduce((sum, a) => sum + a.balance, 0);
        }
      });
      schedulePersist();
    };

    const mutateActive = (fn: (scn: Scenario) => void) => {
      set((s) => {
        const scn = s.scenarios.find((x) => x.id === s.activeScenarioId);
        if (!scn) return;
        fn(scn);
        scn.updatedAt = nowISO();
      });
      schedulePersist();
    };

    function schedulePersist() {
      set((s) => {
        s.saveStatus = 'saving';
      });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const st = get();
        const doc: PersistedDocument = {
          schemaVersion: st.schemaVersion,
          appVersion: st.appVersion,
          savedAt: st.savedAt,
          scenarios: st.scenarios,
          activeScenarioId: st.activeScenarioId,
          settings: st.settings,
          netWorth: st.netWorth,
        };
        const res = saveDocument(doc, st.ui);
        set((s) => {
          s.saveStatus = res.ok ? 'saved' : 'error';
          s.saveError = res.error;
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    }

    return {
      ...init.doc,
      netWorth: init.doc.netWorth ?? { items: [], snapshots: [] },
      ui: init.ui,
      saveStatus: 'idle',
      recovered: init.recovered,

      selectScenario: (id) => {
        set((s) => {
          if (s.scenarios.some((x) => x.id === id)) s.activeScenarioId = id;
        });
        schedulePersist();
      },

      createFromPreset: (key) => {
        // Clone OUTSIDE the immer draft: cloneScenario uses structuredClone, which
        // throws on an immer draft Proxy. get() returns the plain (frozen) state.
        const st = get();
        const base = st.scenarios.find((x) => x.id === st.activeScenarioId) ?? st.scenarios[0];
        const withPreset = applyPreset(cloneScenario(base, PRESETS[key].name, nowISO()), key, nowISO());
        withPreset.kind = undefined; // a preset scenario is not a business-path variant
        set((s) => {
          s.scenarios.push(withPreset);
          s.activeScenarioId = withPreset.id;
        });
        schedulePersist();
      },

      createBlank: () => {
        set((s) => {
          // Inherit household facts (ages, inflation) from the current scenario, but
          // start with a clean financial slate. Expense-driven so the accounts you add
          // immediately drive the tax-aware projection.
          const base = s.scenarios.find((x) => x.id === s.activeScenarioId) ?? s.scenarios[0];
          const a = base.assumptions;
          const ts = nowISO();
          const blank: Scenario = {
            id: newId(),
            name: 'New Scenario',
            presetKey: undefined,
            kind: undefined,
            assumptions: { ...a, startingBalance: base.assumptions.startingBalance },
            contributions: [],
            lumpSums: [],
            incomeStreams: [],
            retirementPhases: [
              { id: newId(), name: 'Retirement', startAge: a.retirementAge, endAge: a.modelEndAge, targetMonthlyIncome: 6000, enabled: true },
            ],
            investmentReturnPhases: [],
            withdrawal: { type: 'percent-of-balance', rate: 0.04, taxStatus: 'taxable' },
            // Accounts are household facts shared by every scenario.
            accounts: JSON.parse(JSON.stringify(base.accounts)),
            expenses: [],
            home: emptyHomePlan(),
            socialSecurity: defaultSocialSecurity(a.retirementAge, a.retirementAge, false),
            healthcare: neutralHealthcare(),
            longTermCare: defaultLongTermCare(),
            inheritance: defaultInheritance(),
            businessVenture: defaultBusinessVenture(),
            withdrawalSequence: s.settings.defaultWithdrawalSequence ?? ['taxable', 'pretax', 'roth'],
            spendingMode: 'expense-driven',
            createdAt: ts,
            updatedAt: ts,
          };
          s.scenarios.push(blank);
          s.activeScenarioId = blank.id;
        });
        schedulePersist();
      },

      duplicateActive: () => {
        // Clone OUTSIDE the immer draft: cloneScenario uses structuredClone, which
        // throws on an immer draft Proxy (this was the "duplicate does nothing" bug).
        const st = get();
        const base = st.scenarios.find((x) => x.id === st.activeScenarioId);
        if (!base) return;
        const cloned = cloneScenario(base, `${base.name} (Copy)`, nowISO());
        set((s) => {
          s.scenarios.push(cloned);
          s.activeScenarioId = cloned.id;
        });
        schedulePersist();
      },

      renameScenario: (id, name) => {
        set((s) => {
          const scn = s.scenarios.find((x) => x.id === id);
          if (scn) {
            scn.name = name.trim() || scn.name;
            scn.updatedAt = nowISO();
          }
        });
        schedulePersist();
      },

      deleteScenario: (id) => {
        set((s) => {
          if (s.scenarios.length <= 1) return;
          s.scenarios = s.scenarios.filter((x) => x.id !== id);
          if (s.activeScenarioId === id) {
            const survivor = [...s.scenarios].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            s.activeScenarioId = survivor.id;
          }
        });
        schedulePersist();
      },

      setAssumption: (key, value) => mutateActive((scn) => {
        (scn.assumptions[key] as ScenarioAssumptions[typeof key]) = value;
      }),

      // Birth date drives currentAge (derived, whole-month precision).
      setBirthDate: (isoDate) => {
        const d = new Date(isoDate + 'T00:00:00');
        if (Number.isNaN(d.getTime())) return;
        mutateActive((scn) => {
          scn.assumptions.birthYear = d.getFullYear();
          scn.assumptions.birthMonth = d.getMonth();
          scn.assumptions.birthDay = d.getDate();
          scn.assumptions.currentAge = ageFromBirthDate(d.getFullYear(), d.getMonth(), d.getDate());
        });
      },

      setWithdrawal: (patch) => mutateActive((scn) => {
        scn.withdrawal = { ...scn.withdrawal, ...patch };
      }),

      addContribution: () => mutateActive((scn) => {
        const a = scn.assumptions;
        // New periods start where the latest existing one ends, so contribution
        // windows stay sequential by default (overlapping months would count
        // both amounts). Gaps are fine: uncovered months simply contribute 0.
        const latestEnd = Math.max(a.currentAge, ...scn.contributions.filter((c) => c.enabled).map((c) => c.endAge));
        const startAge = Math.min(latestEnd, a.modelEndAge - 1 / 12);
        scn.contributions.push({
          id: newId(),
          name: 'New contribution',
          startAge,
          endAge: Math.max(a.retirementAge, startAge + 1),
          monthlyAmount: 0,
          dollarBasis: 'today',
          enabled: true,
        });
      }),
      updateContribution: (id, patch) => mutateActive((scn) => {
        const r = scn.contributions.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
      removeContribution: (id) => mutateActive((scn) => {
        scn.contributions = scn.contributions.filter((x) => x.id !== id);
      }),

      addLumpSum: () => mutateActive((scn) => {
        scn.lumpSums.push({
          id: newId(),
          name: 'New event',
          age: scn.assumptions.currentAge + 1,
          amount: 0,
          dollarBasis: 'actual',
          enabled: true,
        });
      }),
      updateLumpSum: (id, patch) => mutateActive((scn) => {
        const r = scn.lumpSums.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
      removeLumpSum: (id) => mutateActive((scn) => {
        scn.lumpSums = scn.lumpSums.filter((x) => x.id !== id);
      }),

      addIncomeStream: () => mutateActive((scn) => {
        scn.incomeStreams.push({
          id: newId(),
          name: 'New income',
          monthlyAmountToday: 0,
          startAge: scn.assumptions.retirementAge,
          endAge: scn.assumptions.modelEndAge,
          taxStatus: 'taxable',
          cola: scn.assumptions.inflation,
          inflationAdjusted: true,
          owner: 'self',
          enabled: true,
        });
      }),
      updateIncomeStream: (id, patch) => mutateActive((scn) => {
        const r = scn.incomeStreams.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
      removeIncomeStream: (id) => mutateActive((scn) => {
        scn.incomeStreams = scn.incomeStreams.filter((x) => x.id !== id);
      }),

      addRetirementPhase: () => mutateActive((scn) => {
        scn.retirementPhases.push({
          id: newId(),
          name: 'New phase',
          startAge: scn.assumptions.retirementAge,
          endAge: scn.assumptions.modelEndAge,
          targetMonthlyIncome: 8000,
          enabled: true,
        });
      }),
      updateRetirementPhase: (id, patch) => mutateActive((scn) => {
        const r = scn.retirementPhases.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
      removeRetirementPhase: (id) => mutateActive((scn) => {
        scn.retirementPhases = scn.retirementPhases.filter((x) => x.id !== id);
      }),

      addReturnPhase: () => mutateActive((scn) => {
        const phases = scn.investmentReturnPhases;
        const a = scn.assumptions;
        // First phase spans the whole plan at the global return (one tile, full row).
        if (phases.length === 0) {
          phases.push({
            id: newId(),
            name: 'Phase 1',
            startAge: Math.round(a.currentAge),
            endAge: Math.round(a.modelEndAge),
            expectedReturn: a.annualReturn,
            volatility: 0.12,
            enabled: true,
          });
          return;
        }
        // Otherwise split the latest phase in half; the new phase takes the upper half.
        const last = phases.reduce((acc, p) => (p.startAge >= acc.startAge ? p : acc), phases[0]);
        const lo = Math.round(last.startAge);
        const hi = Math.round(last.endAge);
        const mid = hi - lo >= 2 ? Math.round((lo + hi) / 2) : Math.min(hi, lo + 1);
        last.endAge = mid;
        phases.push({
          id: newId(),
          name: `Phase ${phases.length + 1}`,
          startAge: mid,
          endAge: hi,
          expectedReturn: last.expectedReturn,
          volatility: last.volatility,
          enabled: true,
        });
      }),
      updateReturnPhase: (id, patch) => mutateActive((scn) => {
        const r = scn.investmentReturnPhases.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
      removeReturnPhase: (id) => mutateActive((scn) => {
        scn.investmentReturnPhases = scn.investmentReturnPhases.filter((x) => x.id !== id);
      }),

      // ---- v2 accounts (household-mirrored; see mutateAccounts) ----
      addAccount: (kind = 'taxable', name) => mutateAccounts((scn) => {
        scn.accounts.push({
          id: newId(),
          name: name ?? (kind === 'roth' ? 'Roth IRA' : kind === 'pretax' ? 'Pre-tax account' : 'Taxable account'),
          kind,
          balance: 0,
          costBasisRatio: kind === 'taxable' ? get().settings.defaultCostBasisRatio : undefined,
          owner: kind === 'taxable' ? undefined : 'self',
          enabled: true,
          contributionTarget: false,
        });
      }),
      updateAccount: (id, patch) => mutateAccounts((scn) => {
        const a = scn.accounts.find((x) => x.id === id);
        if (a) Object.assign(a, patch);
      }),
      removeAccount: (id) => mutateAccounts((scn) => {
        if (scn.accounts.length <= 1) return; // schema enforces .min(1)
        const wasTarget = scn.accounts.find((x) => x.id === id)?.contributionTarget;
        scn.accounts = scn.accounts.filter((x) => x.id !== id);
        if (wasTarget && !scn.accounts.some((x) => x.contributionTarget)) {
          const fallback =
            scn.accounts.find((x) => x.enabled && x.kind === 'pretax') ??
            scn.accounts.find((x) => x.enabled) ??
            scn.accounts[0];
          if (fallback) fallback.contributionTarget = true;
        }
      }),
      setContributionTarget: (id) => mutateAccounts((scn) => {
        for (const a of scn.accounts) a.contributionTarget = a.id === id;
      }),
      reorderWithdrawalSequence: (seq) => mutateActive((scn) => {
        if (seq.length) scn.withdrawalSequence = seq; // never allow empty (schema .min(1))
      }),

      // ---- v2 expenses ----
      addExpense: (category = 'living') => mutateActive((scn) => {
        scn.expenses.push({
          id: newId(),
          name: 'New expense',
          category,
          amount: 0,
          dollarBasis: 'today',
          startAge: scn.assumptions.retirementAge,
          endAge: scn.assumptions.modelEndAge,
          enabled: true,
        });
      }),
      updateExpense: (id, patch) => mutateActive((scn) => {
        const e = scn.expenses.find((x) => x.id === id);
        if (e) Object.assign(e, patch);
      }),
      removeExpense: (id) => mutateActive((scn) => {
        scn.expenses = scn.expenses.filter((x) => x.id !== id);
      }),

      // ---- v2 config blocks ----
      updateHome: (patch) => mutateActive((scn) => {
        scn.home = { ...scn.home, ...patch };
      }),
      addExtraPrincipal: () => mutateActive((scn) => {
        if (!scn.home.extraPrincipalPayments) scn.home.extraPrincipalPayments = [];
        scn.home.extraPrincipalPayments.push({ id: newId(), age: Math.round(scn.assumptions.currentAge) + 1, amount: 0, enabled: true });
      }),
      updateExtraPrincipal: (id, patch) => mutateActive((scn) => {
        const p = scn.home.extraPrincipalPayments?.find((x) => x.id === id);
        if (p) Object.assign(p, patch);
      }),
      removeExtraPrincipal: (id) => mutateActive((scn) => {
        if (scn.home.extraPrincipalPayments) scn.home.extraPrincipalPayments = scn.home.extraPrincipalPayments.filter((x) => x.id !== id);
      }),

      addLoan: (kind = 'auto') => mutateActive((scn) => {
        if (!scn.liabilities) scn.liabilities = [];
        scn.liabilities.push({ id: newId(), name: kind === 'auto' ? 'Car loan' : 'Loan', kind, balance: 0, rate: 0.06, monthlyPayment: 0, enabled: true });
      }),
      updateLoan: (id, patch) => mutateActive((scn) => {
        const l = scn.liabilities?.find((x) => x.id === id);
        if (l) Object.assign(l, patch);
      }),
      removeLoan: (id) => mutateActive((scn) => {
        if (scn.liabilities) scn.liabilities = scn.liabilities.filter((x) => x.id !== id);
      }),
      updateSocialSecurity: (patch) => mutateActive((scn) => {
        scn.socialSecurity = { ...scn.socialSecurity, ...patch };
      }),
      updateSsClaim: (owner, patch) => mutateActive((scn) => {
        const c = scn.socialSecurity.claims.find((x) => x.owner === owner);
        if (c) Object.assign(c, patch);
      }),
      // The SS planner replaces the legacy "Social Security ..." income rows;
      // toggle them in lockstep so the Planner Sheet reflects what is active.
      // The engine itself (streamNominalAt) independently refuses to double-count
      // a legacy SS row while the planner is on, regardless of this flag's state
      // — this toggle is UI clarity, not the only safeguard.
      setSsPlannerEnabled: (on) => mutateActive((scn) => {
        scn.socialSecurity.enabled = on;
        for (const st of scn.incomeStreams) {
          if (isLegacySsStream(st)) {
            st.enabled = !on;
            st.isSocialSecurity = true; // tag explicitly so a later rename can't break the link
          }
        }
      }),
      updateHealthcare: (patch) => mutateActive((scn) => {
        scn.healthcare = { ...scn.healthcare, ...patch };
      }),
      updateLongTermCare: (patch) => mutateActive((scn) => {
        scn.longTermCare = { ...scn.longTermCare, ...patch };
      }),
      updateInheritance: (patch) => mutateActive((scn) => {
        scn.inheritance = { ...scn.inheritance, ...patch };
      }),
      updateBusinessVenture: (patch) => mutateActive((scn) => {
        scn.businessVenture = { ...scn.businessVenture, ...patch };
      }),
      setSpendingMode: (mode) => mutateActive((scn) => {
        scn.spendingMode = mode;
      }),

      // ---- household net worth statement ----
      addNetWorthItem: (category, liability) => {
        set((s) => {
          if (!s.netWorth) s.netWorth = { items: [], snapshots: [] };
          s.netWorth.items.push({
            id: newId(),
            name: liability ? 'New debt' : 'New asset',
            category,
            value: 0,
            liability: liability || undefined,
            lastUpdated: new Date().toISOString().slice(0, 10),
          });
        });
        schedulePersist();
      },
      updateNetWorthItem: (id, patch) => {
        set((s) => {
          const it = s.netWorth?.items.find((x) => x.id === id);
          if (!it) return;
          Object.assign(it, patch);
          if ('value' in patch) it.lastUpdated = new Date().toISOString().slice(0, 10);
        });
        schedulePersist();
      },
      removeNetWorthItem: (id) => {
        set((s) => {
          if (s.netWorth) s.netWorth.items = s.netWorth.items.filter((x) => x.id !== id);
        });
        schedulePersist();
      },
      saveNetWorthSnapshot: (snap) => {
        set((s) => {
          if (!s.netWorth) s.netWorth = { items: [], snapshots: [] };
          // One snapshot per day: re-saving today replaces today's entry.
          s.netWorth.snapshots = [...s.netWorth.snapshots.filter((x) => x.date !== snap.date), snap].sort((x, y) =>
            x.date.localeCompare(y.date),
          );
        });
        schedulePersist();
      },

      updateSettings: (patch) => {
        set((s) => {
          s.settings = { ...s.settings, ...patch };
        });
        schedulePersist();
      },
      setTheme: (theme) => {
        set((s) => {
          s.settings.theme = theme;
        });
        document.documentElement.dataset.theme = theme;
        schedulePersist();
      },
      setDisplayModeOverride: (mode) => {
        set((s) => {
          s.ui.displayModeOverride = mode;
        });
        schedulePersist();
      },
      setChartRange: (r) => {
        set((s) => {
          s.ui.chartRange = r;
        });
        schedulePersist();
      },
      toggleMcBand: (on) => {
        set((s) => {
          s.ui.showMonteCarloBand = on ?? !s.ui.showMonteCarloBand;
        });
        schedulePersist();
      },
      toggleSidebar: (on) => {
        set((s) => {
          s.ui.sidebarCollapsed = on ?? !s.ui.sidebarCollapsed;
        });
        schedulePersist();
      },
      toggleRail: (on) => {
        set((s) => {
          s.ui.railCollapsed = on ?? !s.ui.railCollapsed;
        });
        schedulePersist();
      },

      replaceDocument: (doc) => {
        deriveCurrentAges(doc);
        mirrorAccountsFromActive(doc);
        reconcileSsPlanner(doc);
        set((s) => {
          s.schemaVersion = doc.schemaVersion;
          s.appVersion = doc.appVersion;
          s.savedAt = doc.savedAt;
          s.scenarios = doc.scenarios;
          s.activeScenarioId = doc.activeScenarioId;
          s.settings = doc.settings;
          s.netWorth = doc.netWorth ?? { items: [], snapshots: [] };
          s.recovered = undefined;
        });
        document.documentElement.dataset.theme = doc.settings.theme;
        schedulePersist();
      },
    };
  }),
);

// ---- selectors / hooks ----
export const useActiveScenario = (): Scenario => {
  return useStore((s) => s.scenarios.find((x) => x.id === s.activeScenarioId) ?? s.scenarios[0]);
};

export const useEffectiveDisplayMode = (): DisplayMode => {
  // Default to actual (future) dollars; the toggle sets an explicit override.
  return useStore((s) => s.ui.displayModeOverride ?? 'actual');
};
