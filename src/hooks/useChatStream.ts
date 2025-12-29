import { useCallback, useState } from "react";
import type { ChatMessage, ProviderType } from "@/services/llm/types";

interface UseChatStreamResult {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  resetChat: () => void;
}

interface UseChatStreamOptions {
  provider?: ProviderType;
  model?: string;
}

export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { provider = "gemini", model } = options;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = { role: "user", content };

      // Optimistically add user message
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            provider,
            model,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch response");
        }

        if (!response.body) {
          throw new Error("Response body is empty");
        }

        // Initialize empty model message
        setMessages((prev) => [...prev, { role: "model", content: "" }]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          // Update the last message (model's response) with accumulated text
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg.role === "model") {
              lastMsg.content = accumulatedText;
            }
            return newMessages;
          });
        }
      } catch (error) {
        console.error("Chat error:", error);
        // Optionally handle error state here
      } finally {
        setIsLoading(false);
      }
    },
    [messages, provider, model]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    resetChat,
  };
}
