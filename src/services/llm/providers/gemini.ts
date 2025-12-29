import { type Content, GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMessage, LLMOptions, LLMProvider } from "../types";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = "gemini-2.5-flash-lite") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generateStream(
    messages: ChatMessage[],
    options?: LLMOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
        topP: options?.topP,
        topK: options?.topK,
      },
    });

    // Convert internal ChatMessage to Gemini Content format
    const history: Content[] = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessageStream(prompt);

    // Create a ReadableStream from the Gemini stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return stream;
  }
}
