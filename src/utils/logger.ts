import { LogLevel } from "@/types/LogLevel";
import fs from "fs";
import path from "path";

/**
 * Logs a message to the specified file.
 * @param logFilePath Path to the log file.
 * @param level Log level (DEBUG/INFO/WARN/ERROR).
 * @param message Log message.
 */
export function logMessage(logFilePath: string, level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;

  try {
    const absolutePath = path.resolve(logFilePath);
    fs.appendFileSync(absolutePath, logEntry, "utf8");
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}
