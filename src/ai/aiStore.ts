import { create } from 'zustand';
import { clearAiConfig, defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig } from './config';

interface AiState {
  config: AiConfig;
  /**
   * Generated narration per scenario id, held for the session so navigating
   * away and back does not silently spend another API call. Deliberately not
   * persisted: it would go stale the moment any input changes.
   */
  narrations: Record<string, string>;
  setConfig: (cfg: AiConfig) => void;
  forgetKeys: () => void;
  setNarration: (scenarioId: string, text: string) => void;
  clearNarration: (scenarioId: string) => void;
}

export const useAiStore = create<AiState>()((set) => ({
  config: loadAiConfig(),
  narrations: {},
  setConfig: (cfg) => {
    saveAiConfig(cfg);
    set({ config: cfg });
  },
  forgetKeys: () => {
    clearAiConfig();
    set({ config: defaultAiConfig(), narrations: {} });
  },
  setNarration: (scenarioId, text) => set((s) => ({ narrations: { ...s.narrations, [scenarioId]: text } })),
  clearNarration: (scenarioId) =>
    set((s) => {
      const next = { ...s.narrations };
      delete next[scenarioId];
      return { narrations: next };
    }),
}));
