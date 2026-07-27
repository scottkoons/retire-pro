// ============================================================================
// Provider-neutral AI client.
//
// Features call this interface and never a provider SDK directly, so swapping
// Anthropic for OpenAI is a Settings change rather than a code change.
//
// Both SDKs are loaded with dynamic import() so they land in their own lazily
// fetched chunk: a user who never opens an AI feature never downloads either
// one, which matters on a static host where the whole app ships to the browser.
// ============================================================================

import { activeProviderConfig, type AiConfig, type AiProviderId } from './config';

export interface AiTextRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiStructuredRequest extends AiTextRequest {
  /** Schema name required by OpenAI's strict json_schema mode. */
  schemaName: string;
  /**
   * JSON Schema for the reply. Must set `additionalProperties: false` and list
   * every property in `required` — OpenAI's strict mode rejects anything else,
   * and Anthropic's structured outputs are happy with the same shape.
   */
  schema: Record<string, unknown>;
}

export interface AiClient {
  generateText(req: AiTextRequest): Promise<string>;
  /** Parsed object matching the supplied schema. */
  generateStructured<T>(req: AiStructuredRequest): Promise<T>;
}

/** Error carrying a human-readable hint for the Settings panel. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const DEFAULT_MAX_TOKENS = 2000;

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function anthropicClient(apiKey: string, model: string): Promise<AiClient> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The browser guard exists to stop apps shipping a shared key to untrusted
  // users. Here the key is the user's own, typed on their own machine, and is
  // never bundled or transmitted anywhere but Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const textOf = (content: { type: string }[]): string =>
    content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

  return {
    async generateText({ system, prompt, maxTokens }) {
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      return textOf(res.content);
    },
    async generateStructured<T>({ system, prompt, schema, maxTokens }: AiStructuredRequest): Promise<T> {
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: { type: 'json_schema', schema } },
      });
      return JSON.parse(textOf(res.content)) as T;
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function openaiClient(apiKey: string, model: string): Promise<AiClient> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  return {
    async generateText({ system, prompt, maxTokens }) {
      const res = await client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      });
      return (res.choices[0]?.message?.content ?? '').trim();
    },
    async generateStructured<T>({ system, prompt, schema, schemaName, maxTokens }: AiStructuredRequest): Promise<T> {
      const res = await client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, schema, strict: true },
        },
      });
      const text = res.choices[0]?.message?.content ?? '';
      return JSON.parse(text) as T;
    },
  };
}

// ---------------------------------------------------------------------------

export async function createAiClient(cfg: AiConfig): Promise<AiClient> {
  const { apiKey, model } = activeProviderConfig(cfg);
  if (!apiKey.trim()) {
    throw new AiError('No API key set.', 'Add a key in Settings under AI Assistant.');
  }
  return cfg.provider === 'openai' ? openaiClient(apiKey.trim(), model) : anthropicClient(apiKey.trim(), model);
}

/**
 * Cheapest possible round trip, used by the Settings "Test connection" button
 * so a bad key or a wrong model name fails here rather than inside a feature.
 */
export async function testAiConnection(cfg: AiConfig): Promise<string> {
  const client = await createAiClient(cfg);
  const reply = await client.generateText({
    system: 'Reply with the single word OK and nothing else.',
    prompt: 'Connection test.',
    maxTokens: 16,
  });
  return reply.trim() || '(empty reply)';
}

/**
 * Turn a provider/network failure into something worth showing the user.
 *
 * `provider` matters for the connection-error case. OpenAI returns its
 * "invalid key" 401 WITHOUT an `access-control-allow-origin` header, so the
 * browser refuses to expose the response and the SDK can only report a generic
 * connection failure. A mistyped key is by far the likeliest cause, so say so
 * rather than sending the user off to debug their network.
 */
export function describeAiError(err: unknown, provider?: AiProviderId): { message: string; hint?: string } {
  if (err instanceof AiError) return { message: err.message, hint: err.hint };
  const raw = err instanceof Error ? err.message : String(err);
  if (/\b401\b|unauthor|invalid[_ -]?api[_ -]?key/i.test(raw)) {
    return { message: 'The provider rejected that API key.', hint: 'Check the key in Settings under AI Assistant.' };
  }
  if (/\b404\b|model.*not.*found|unknown model|does not exist/i.test(raw)) {
    return { message: 'That model name was not recognised.', hint: 'Check the model field for this provider in Settings.' };
  }
  if (/\b429\b|rate.?limit|quota/i.test(raw)) {
    return { message: 'Rate limited by the provider, or the account is out of quota.', hint: 'Wait a moment and try again.' };
  }
  if (/Connection error|Failed to fetch|NetworkError|ERR_BLOCKED|Content Security Policy/i.test(raw)) {
    return provider === 'openai'
      ? {
          message: 'Could not reach OpenAI.',
          hint: 'This is usually a wrong API key: OpenAI hides the real error from the browser when it rejects a key. Check the key and the model name in Settings.',
        }
      : {
          message: 'The request to the provider was blocked.',
          hint: 'Check your network connection. If this persists the page may need reloading.',
        };
  }
  return { message: raw };
}
