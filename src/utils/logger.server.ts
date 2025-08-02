import type { LogLevel } from "@/types/LogLevel";

/**
 * Send a log message from client-side to server-side log API
 * @param filePath Path to the log file
 * @param level Log level
 * @param message Log message
 */
export async function logMessage(
  filePath: string,
  level: LogLevel,
  message: string
): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, level, message }),
    });
  } catch (err) {
    console.error("Failed to log message:", err);
  }
}
