import type { LogLevel } from "@/types/LogLevel";

/**
 * Send a log message from client-side to server-side log API
 * @param app Application or feature ID (e.g., "umatoma", "line-viewer")
 * @param level Log level
 * @param message Log message
 * @param context Additional context data
 */
export async function logMessage(
  app: string,
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app, level, message, context }),
    });
  } catch (err) {
    // Fallback to console if logging fails
    console.error("Failed to send log to server:", err);
  }
}
