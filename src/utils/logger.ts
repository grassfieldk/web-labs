import fs from "fs";
import path from "path";
import type { LogLevel } from "@/types/LogLevel";

/**
 * Write log messages to file with timestamp and level
 *
 * @param logFilePath Path to the log file
 * @param level Log level
 * @param message Log message
 *
 * @example
 * writeLog("./app.log", "INFO", "Application started");
 */
function writeLog(logFilePath: string, level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;

  try {
    const absolutePath = path.resolve(logFilePath);
    fs.appendFileSync(absolutePath, logEntry, "utf8");
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

/**
 * Log messages to file with specified level
 *
 * @param level Log level
 * @param logFilePath Path to the log file
 * @param message Log message
 *
 * @example
 * log("INFO", "./app.log", "Application started");
 */
function log(level: LogLevel, logFilePath: string, message: string): void {
  writeLog(logFilePath, level, message);
}

log.debug = (logFilePath: string, message: string) =>
  writeLog(logFilePath, "DEBUG", message);
log.info = (logFilePath: string, message: string) =>
  writeLog(logFilePath, "INFO", message);
log.warn = (logFilePath: string, message: string) =>
  writeLog(logFilePath, "WARN", message);
log.error = (logFilePath: string, message: string) =>
  writeLog(logFilePath, "ERROR", message);

export { log };

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
