import { GeminiProvider } from "./providers/gemini";
import type { LLMProvider, ProviderType } from "./types";

/**
 * Create an instance of LLMProvider based on the provider type.
 * Automatically loads API keys from environment variables.
 *
 * @param provider "gemini" | "openai" etc.
 * @param model Optional model name override
 * @returns LLMProvider instance
 */
export function createLLMProvider(provider: ProviderType, model?: string): LLMProvider {
  switch (provider) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }
      return new GeminiProvider(apiKey, model);
    }
    // Future providers:
    // case "openai":
    //   return new OpenAIProvider(process.env.OPENAI_API_KEY, model);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
