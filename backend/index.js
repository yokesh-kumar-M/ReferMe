const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

// ── AI providers ──────────────────────────────────────────────────────────────

async function callGemini(systemPrompt, userPrompt, maxTokens = 4096) {
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

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "", provider: "gemini" };
}

async function callGroq(systemPrompt, userPrompt, maxTokens = 4096) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", provider: "groq" };
}

async function callMistral(systemPrompt, userPrompt, maxTokens = 4096) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", provider: "mistral" };
}

async function callAI(systemPrompt, userPrompt, maxTokens) {
  const providers = [
    () => callGemini(systemPrompt, userPrompt, maxTokens),
    () => callGroq(systemPrompt, userPrompt, maxTokens),
    () => callMistral(systemPrompt, userPrompt, maxTokens),
  ];

  let lastError;
  for (const fn of providers) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn("[AI] Provider failed, trying next:", err.message);
    }
  }
  throw lastError ?? new Error("All AI providers failed");
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

async function streamGemini(systemPrompt, userPrompt, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

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

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch {}
    }
  }
}

async function streamOpenAICompat(endpoint, apiKey, model, systemPrompt, userPrompt, res) {
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!upstream.ok) throw new Error(`Stream error ${upstream.status}`);

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (raw === "[DONE]") { res.write("data: [DONE]\n\n"); return; }
      try {
        const text = JSON.parse(raw).choices?.[0]?.delta?.content ?? "";
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch {}
    }
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/ai", async (req, res) => {
  try {
    const { systemPrompt, userPrompt, stream = false, maxTokens } = req.body;

    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: "systemPrompt and userPrompt are required." });
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (process.env.GEMINI_API_KEY) {
        try { await streamGemini(systemPrompt, userPrompt, res); res.write("data: [DONE]\n\n"); res.end(); return; }
        catch (err) { console.warn("[AI] Gemini stream failed:", err.message); }
      }
      if (process.env.GROQ_API_KEY) {
        try {
          const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
          await streamOpenAICompat("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, model, systemPrompt, userPrompt, res);
          res.write("data: [DONE]\n\n"); res.end(); return;
        } catch (err) { console.warn("[AI] Groq stream failed:", err.message); }
      }
      if (process.env.MISTRAL_API_KEY) {
        const model = process.env.MISTRAL_MODEL || "mistral-small-latest";
        await streamOpenAICompat("https://api.mistral.ai/v1/chat/completions", process.env.MISTRAL_API_KEY, model, systemPrompt, userPrompt, res);
        res.write("data: [DONE]\n\n"); res.end(); return;
      }

      res.write(`data: ${JSON.stringify({ error: "No AI provider configured" })}\n\n`);
      res.end();
      return;
    }

    const { text, provider } = await callAI(systemPrompt, userPrompt, maxTokens);
    res.json({ text, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ReferMe backend running on port ${PORT}`));
