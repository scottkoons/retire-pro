// ============================================================================
// AI provider configuration — API keys and model choice.
//
// SECURITY: this lives under its OWN localStorage key and is deliberately NOT
// part of PersistedDocument. That is structural, not a convention: `backupJSON`
// serializes only the document, so a key can never ride along into an exported
// backup file, the clipboard transfer, or the plan file on disk. Do not move
// these fields into the document schema.
//
// The keys are the user's own, stored on the user's own machine, and are sent
// only to the provider they belong to. Anyone else opening the app supplies
// their own key or gets no AI features at all.
// ============================================================================

export type AiProviderId = 'anthropic' | 'openai';

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

export interface AiConfig {
  provider: AiProviderId;
  anthropic: AiProviderConfig;
  openai: AiProviderConfig;
}

const AI_STORAGE_KEY = 'retirepro:ai:v1';

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
};

/**
 * Model defaults. Both are editable in Settings because provider line-ups move
 * faster than this app ships — if a default is retired, the field is the fix.
 */
export function defaultAiConfig(): AiConfig {
  return {
    provider: 'anthropic',
    anthropic: { apiKey: '', model: 'claude-sonnet-5' },
    openai: { apiKey: '', model: 'gpt-4o' },
  };
}

function readString(o: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const v = o?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function loadAiConfig(): AiConfig {
  const base = defaultAiConfig();
  let raw: unknown;
  try {
    const text = localStorage.getItem(AI_STORAGE_KEY);
    if (!text) return base;
    raw = JSON.parse(text);
  } catch {
    return base; // unreadable entry: fall back rather than break the settings page
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  const provider = o.provider === 'openai' ? 'openai' : 'anthropic';
  const anthropic = o.anthropic as Record<string, unknown> | undefined;
  const openai = o.openai as Record<string, unknown> | undefined;
  return {
    provider,
    anthropic: {
      apiKey: readString(anthropic, 'apiKey', ''),
      model: readString(anthropic, 'model', base.anthropic.model),
    },
    openai: {
      apiKey: readString(openai, 'apiKey', ''),
      model: readString(openai, 'model', base.openai.model),
    },
  };
}

export function saveAiConfig(cfg: AiConfig): void {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(cfg));
}

/** Wipe both keys. Used by the Settings "Forget keys" action. */
export function clearAiConfig(): void {
  localStorage.removeItem(AI_STORAGE_KEY);
}

export function activeProviderConfig(cfg: AiConfig): AiProviderConfig {
  return cfg.provider === 'openai' ? cfg.openai : cfg.anthropic;
}

export function hasActiveKey(cfg: AiConfig): boolean {
  return activeProviderConfig(cfg).apiKey.trim().length > 0;
}

/** Masked form for display, so a key is never rendered in full after entry. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return k.length <= 12 ? '••••' : `${k.slice(0, 6)}…${k.slice(-4)}`;
}
