import { NextResponse } from "next/server";
import { createLLMProvider } from "@/services/llm/factory";
import type { ChatMessage } from "@/services/llm/types";
import { log } from "@/utils/logger.server";

export const runtime = "nodejs"; // or 'edge' if supported by the provider

export async function POST(req: Request) {
  try {
    const { messages, provider = "gemini", model } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const llmProvider = createLLMProvider(provider, model);
    const stream = await llmProvider.generateStream(messages as ChatMessage[]);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    log.error("llm-api", "Error generating response", { error: String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate response" },
      { status: 500 }
    );
  }
}
