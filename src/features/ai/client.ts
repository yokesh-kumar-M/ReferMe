// Provider-agnostic AI client. Three concerns live here and nowhere else:
//   1. How to call each provider (Groq / Gemini / Mistral) for both
//      one-shot JSON and streaming text.
//   2. The fallback chain when the primary provider errors.
//   3. Surface-friendly hooks (async iterator over text deltas).
//
// Surfaces (popup, dashboard, content script) should never `fetch` an AI
// endpoint directly — always go through `generateText` / `streamText` /
// `generateJSON`.

import type { AIKeys, AIProvider, ProviderModel } from "@/types";
import { DEFAULT_MODELS } from "@/types";

export interface AICallOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIClientConfig {
  keys: AIKeys;
  models?: Partial<ProviderModel>;
  primary?: AIProvider; // override the default order
}

const DEFAULT_ORDER: AIProvider[] = ["groq", "gemini", "mistral"];

function orderFor(cfg: AIClientConfig): AIProvider[] {
  const order = [...DEFAULT_ORDER];
  if (cfg.primary) {
    return [cfg.primary, ...order.filter((p) => p !== cfg.primary)];
  }
  return order;
}

function keyFor(provider: AIProvider, keys: AIKeys): string {
  return keys[provider] || "";
}

function modelFor(provider: AIProvider, cfg: AIClientConfig): string {
  return cfg.models?.[provider] || DEFAULT_MODELS[provider];
}

// ──────────────────────────────────────────────────────────────────────
// One-shot text generation
// ──────────────────────────────────────────────────────────────────────

export async function generateText(
  cfg: AIClientConfig,
  opts: AICallOptions
): Promise<{ text: string; provider: AIProvider }> {
  const order = orderFor(cfg);
  let lastErr: Error | null = null;

  for (const provider of order) {
    const apiKey = keyFor(provider, cfg.keys);
    if (!apiKey) continue;
    try {
      const text = await callOnce(provider, apiKey, modelFor(provider, cfg), opts);
      return { text, provider };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] ${provider} failed:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error("No AI provider configured — add a Groq or Gemini key in Settings.");
}

async function callOnce(
  provider: AIProvider,
  apiKey: string,
  model: string,
  opts: AICallOptions
): Promise<string> {
  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.6,
          maxOutputTokens: opts.maxTokens ?? 4096,
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.mistral.ai/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${provider} ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ──────────────────────────────────────────────────────────────────────
// JSON generation (strict mode for autofill profile extraction)
// ──────────────────────────────────────────────────────────────────────

export async function generateJSON<T = unknown>(
  cfg: AIClientConfig,
  opts: AICallOptions
): Promise<T> {
  const order = orderFor(cfg);
  let lastErr: Error | null = null;

  for (const provider of order) {
    const apiKey = keyFor(provider, cfg.keys);
    if (!apiKey) continue;
    try {
      const raw = await callJSONOnce(provider, apiKey, modelFor(provider, cfg), opts);
      return JSON.parse(raw) as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] ${provider} json failed:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error("No AI provider configured.");
}

async function callJSONOnce(
  provider: AIProvider,
  apiKey: string,
  model: string,
  opts: AICallOptions
): Promise<string> {
  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.1,
          maxOutputTokens: opts.maxTokens ?? 2048,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  }

  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.mistral.ai/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

// ──────────────────────────────────────────────────────────────────────
// Streaming text (async iterator over deltas)
// ──────────────────────────────────────────────────────────────────────

export async function* streamText(
  cfg: AIClientConfig,
  opts: AICallOptions
): AsyncGenerator<string, void, void> {
  const order = orderFor(cfg);
  let lastErr: Error | null = null;

  for (const provider of order) {
    const apiKey = keyFor(provider, cfg.keys);
    if (!apiKey) continue;
    try {
      yield* streamFromProvider(provider, apiKey, modelFor(provider, cfg), opts);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] ${provider} stream failed:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error("No AI provider configured.");
}

async function* streamFromProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  opts: AICallOptions
): AsyncGenerator<string, void, void> {
  if (provider === "gemini") {
    yield* streamGemini(apiKey, model, opts);
    return;
  }
  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.mistral.ai/v1/chat/completions";
  yield* streamOpenAICompat(endpoint, apiKey, model, opts);
}

async function* streamOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  opts: AICallOptions
): AsyncGenerator<string, void, void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Stream ${res.status}: ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) yield delta;
      } catch {
        // skip malformed
      }
    }
  }
}

async function* streamGemini(
  apiKey: string,
  model: string,
  opts: AICallOptions
): AsyncGenerator<string, void, void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.6,
        maxOutputTokens: opts.maxTokens ?? 4096,
      },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Gemini stream ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        const text: string = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) yield text;
      } catch {
        // skip malformed
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Health check — does the user have a usable key at all?
// ──────────────────────────────────────────────────────────────────────

export function hasUsableKey(keys: AIKeys): boolean {
  return !!(keys.groq || keys.gemini || keys.mistral);
}
