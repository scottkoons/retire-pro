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
  addAccount: (kind?: AccountKind) => void;
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
  updateHealthcare: (patch: Partial<HealthcareConfig>) => void;
  updateLongTermCare: (patch: Partial<LongTermCareConfig>) => void;
  updateInheritance: (patch: Partial<InheritanceConfig>) => void;
  updateBusinessVenture: (patch: Partial<BusinessVentureConfig>) => void;
  setSpendingMode: (mode: SpendingMode) => void;

  // settings / ui
  updateSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setDisplayModeOverride: (mode: DisplayMode | null) => void;
  setChartRange: (r: '10Y' | 'MAX') => void;
  toggleMcBand: (on?: boolean) => void;
  toggleSidebar: (on?: boolean) => void;

  // document-level
  replaceDocument: (doc: PersistedDocument) => void;
}

const init = loadDocument();
const nowISO = () => new Date().toISOString();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<StoreState>()(
  immer((set, get) => {
    const touchActive = (s: StoreState) => {
      const scn = s.scenarios.find((x) => x.id === s.activeScenarioId);
      if (scn) scn.updatedAt = nowISO();
    };

    // The Dashboard "Starting Amount" is the total of enabled accounts. Keep the
    // legacy startingBalance mirror in lockstep on every account edit so the
    // summary, PDF export, and legacy projection agree with the accounts total.
    const syncStartingBalance = (scn: Scenario) => {
      scn.assumptions.startingBalance = scn.accounts
        .filter((a) => a.enabled)
        .reduce((sum, a) => sum + a.balance, 0);
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
            assumptions: { ...a, startingBalance: 0 },
            contributions: [],
            lumpSums: [],
            incomeStreams: [],
            retirementPhases: [
              { id: newId(), name: 'Retirement', startAge: a.retirementAge, endAge: a.modelEndAge, targetMonthlyIncome: 6000, enabled: true },
            ],
            investmentReturnPhases: [],
            withdrawal: { type: 'percent-of-balance', rate: 0.04, taxStatus: 'taxable' },
            accounts: [
              { id: newId(), name: 'Taxable brokerage', kind: 'taxable', balance: 0, costBasisRatio: s.settings.defaultCostBasisRatio, enabled: true, contributionTarget: true },
            ],
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

      setWithdrawal: (patch) => mutateActive((scn) => {
        scn.withdrawal = { ...scn.withdrawal, ...patch };
      }),

      addContribution: () => mutateActive((scn) => {
        scn.contributions.push({
          id: newId(),
          name: 'New contribution',
          startAge: scn.assumptions.currentAge,
          endAge: scn.assumptions.retirementAge,
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

      // ---- v2 accounts ----
      addAccount: (kind = 'taxable') => mutateActive((scn) => {
        scn.accounts.push({
          id: newId(),
          name: kind === 'roth' ? 'Roth IRA' : kind === 'pretax' ? 'Pre-tax account' : 'Taxable account',
          kind,
          balance: 0,
          costBasisRatio: kind === 'taxable' ? get().settings.defaultCostBasisRatio : undefined,
          owner: kind === 'taxable' ? undefined : 'self',
          enabled: true,
          contributionTarget: false,
        });
        syncStartingBalance(scn);
      }),
      updateAccount: (id, patch) => mutateActive((scn) => {
        const a = scn.accounts.find((x) => x.id === id);
        if (a) Object.assign(a, patch);
        syncStartingBalance(scn);
      }),
      removeAccount: (id) => mutateActive((scn) => {
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
        syncStartingBalance(scn);
      }),
      setContributionTarget: (id) => mutateActive((scn) => {
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

      replaceDocument: (doc) => {
        set((s) => {
          s.schemaVersion = doc.schemaVersion;
          s.appVersion = doc.appVersion;
          s.savedAt = doc.savedAt;
          s.scenarios = doc.scenarios;
          s.activeScenarioId = doc.activeScenarioId;
          s.settings = doc.settings;
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
