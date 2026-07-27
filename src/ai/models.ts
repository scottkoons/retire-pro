// ============================================================================
// Model choices for the AI Assistant settings panel.
//
// The model is chosen from a list rather than typed, so a working model is one
// click away and a typo can never reach the provider.  Provider line-ups still
// move faster than this app ships, which is why the list is not purely
// hardcoded: whenever a key is on file, the panel asks the provider which
// models that key can actually reach.  The catalogs below are the fallback for
// a provider with no key yet, or one whose list request fails.
//
// Listing models is a free, read-only call at both providers, and the key is
// the same one already stored for this provider, so nothing new is exposed.
// ============================================================================

import type { AiProviderId } from './config';

export interface ModelOption {
  /** Exact id sent to the provider. */
  id: string;
  /** What the dropdown shows. */
  label: string;
}

/**
 * Baked-in catalogs, newest and most capable first.  These are a safety net,
 * not the source of truth: a provider that has retired or added a model will
 * say so through its own list, which overrides this the moment a key is set.
 */
export const FALLBACK_MODELS: Record<AiProviderId, ModelOption[]> = {
  anthropic: [
    { id: 'claude-opus-5', label: 'Claude Opus 5' },
    { id: 'claude-fable-5', label: 'Claude Fable 5' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5', label: 'gpt-5' },
    { id: 'gpt-5-mini', label: 'gpt-5-mini' },
    { id: 'gpt-4.1', label: 'gpt-4.1' },
    { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { id: 'gpt-4o', label: 'gpt-4o' },
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  ],
};

// OpenAI lists every model on the account, including embeddings, speech, and
// image models that this app cannot talk to.  Keep the chat families, drop the
// rest, and drop dated snapshots so the picker shows one entry per model
// rather than one per release date.
const OPENAI_CHAT_FAMILY = /^(gpt-|o1|o3|o4|chatgpt-)/;
const OPENAI_NOT_CHAT = /audio|realtime|transcribe|tts|image|dall-e|embed|moderation|search|instruct|computer-use|codex/;
const DATED_SNAPSHOT = /-\d{4}-\d{2}-\d{2}$|-\d{4}$/;

/**
 * Ask the provider which models this key can reach.  Errors are left to the
 * caller so they can run through `describeAiError` like any other request.
 */
export async function fetchProviderModels(provider: AiProviderId, apiKey: string): Promise<ModelOption[]> {
  const key = apiKey.trim();
  if (provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    const out: ModelOption[] = [];
    // Already newest first, and the display name is the one Anthropic uses.
    for await (const m of client.models.list({ limit: 100 })) {
      out.push({ id: m.id, label: m.display_name || m.id });
      if (out.length >= 100) break;
    }
    return out;
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  const raw: { id: string; created: number }[] = [];
  for await (const m of client.models.list()) {
    raw.push({ id: m.id, created: m.created ?? 0 });
    if (raw.length >= 500) break;
  }
  return raw
    .filter((m) => OPENAI_CHAT_FAMILY.test(m.id) && !OPENAI_NOT_CHAT.test(m.id) && !DATED_SNAPSHOT.test(m.id))
    .sort((a, b) => b.created - a.created)
    .map((m) => ({ id: m.id, label: m.id }));
}

/**
 * Guarantee the saved model is always selectable.  A key that reaches a
 * limited set of models, or a config carried over from an earlier release,
 * must never leave the dropdown silently pointing at something else.
 */
export function withCurrentModel(options: ModelOption[], current: string): ModelOption[] {
  const id = current.trim();
  if (!id || options.some((o) => o.id === id)) return options;
  return [...options, { id, label: `${id} (current)` }];
}
