export type Role = "user" | "model" | "system";

export type ProviderType = "gemini";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export interface LLMProvider {
  generateStream(
    messages: ChatMessage[],
    options?: LLMOptions
  ): Promise<ReadableStream<Uint8Array>>;
}
