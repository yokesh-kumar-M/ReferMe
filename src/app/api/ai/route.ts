import { NextRequest, NextResponse } from "next/server";
import { callAI, streamAI } from "@/lib/ai-providers";

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userPrompt, stream = false, maxTokens } = await req.json();

    if (!systemPrompt || !userPrompt) {
      return NextResponse.json({ error: "systemPrompt and userPrompt are required." }, { status: 400 });
    }

    if (stream) {
      const readable = await streamAI(systemPrompt, userPrompt);
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const { text, provider } = await callAI({ systemPrompt, userPrompt, maxTokens });
    return NextResponse.json({ text, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
