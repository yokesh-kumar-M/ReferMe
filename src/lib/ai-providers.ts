type Provider = "gemini" | "groq" | "mistral";

interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

interface AIResponse {
  text: string;
  provider: Provider;
}

// --- Gemini ---
async function callGemini({ systemPrompt, userPrompt, maxTokens = 4096 }: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text, provider: "gemini" };
}

// --- Groq (OpenAI-compatible) ---
async function callGroq({ systemPrompt, userPrompt, maxTokens = 4096 }: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, provider: "groq" };
}

// --- Mistral (OpenAI-compatible) ---
async function callMistral({ systemPrompt, userPrompt, maxTokens = 4096 }: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, provider: "mistral" };
}

// --- Streaming: Gemini SSE ---
async function streamGemini(systemPrompt: string, userPrompt: string): Promise<ReadableStream> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });

  if (!upstream.ok) throw new Error(`Gemini stream error ${upstream.status}`);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") continue;
          try {
            const chunk = JSON.parse(raw);
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } catch {}
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// --- Streaming: OpenAI-compatible (Groq / Mistral) ---
async function streamOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<ReadableStream> {
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!upstream.ok) throw new Error(`Stream error ${upstream.status} from ${endpoint}`);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          try {
            const chunk = JSON.parse(raw);
            const text = chunk.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } catch {}
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// --- Public API ---

/** Call AI with automatic fallback: Gemini → Groq → Mistral */
export async function callAI(req: AIRequest): Promise<AIResponse> {
  const providers: Array<() => Promise<AIResponse>> = [
    () => callGemini(req),
    () => callGroq(req),
    () => callMistral(req),
  ];

  let lastError: Error | null = null;
  for (const fn of providers) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] Provider failed, trying next:`, lastError.message);
    }
  }
  throw lastError ?? new Error("All AI providers failed");
}

/** Stream AI response with automatic fallback: Gemini → Groq → Mistral */
export async function streamAI(systemPrompt: string, userPrompt: string): Promise<ReadableStream> {
  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      return await streamGemini(systemPrompt, userPrompt);
    } catch (err) {
      console.warn("[AI] Gemini stream failed:", (err as Error).message);
    }
  }

  // Fallback: Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      return await streamOpenAICompat(
        "https://api.groq.com/openai/v1/chat/completions",
        process.env.GROQ_API_KEY,
        model,
        systemPrompt,
        userPrompt
      );
    } catch (err) {
      console.warn("[AI] Groq stream failed:", (err as Error).message);
    }
  }

  // Fallback: Mistral
  if (process.env.MISTRAL_API_KEY) {
    const model = process.env.MISTRAL_MODEL || "mistral-small-latest";
    return await streamOpenAICompat(
      "https://api.mistral.ai/v1/chat/completions",
      process.env.MISTRAL_API_KEY,
      model,
      systemPrompt,
      userPrompt
    );
  }

  throw new Error("No AI provider configured");
}
