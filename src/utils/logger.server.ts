import type { LogLevel } from "@/types/LogLevel";

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Output log in JSON format to stdout/stderr
 *
 * @param level Log level
 * @param app Application or feature ID
 * @param message Log message
 * @param context Additional context data
 */
function output(
  level: LogLevel,
  app: string,
  message: string,
  context?: LogContext
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    app,
    message,
    context,
  };

  const json = JSON.stringify(entry);

  if (level === "ERROR") {
    console.error(json);
  } else {
    console.log(json);
  }
}

export const log = {
  debug: (app: string, message: string, context?: LogContext) =>
    output("DEBUG", app, message, context),
  info: (app: string, message: string, context?: LogContext) =>
    output("INFO", app, message, context),
  warn: (app: string, message: string, context?: LogContext) =>
    output("WARN", app, message, context),
  error: (app: string, message: string, context?: LogContext) =>
    output("ERROR", app, message, context),
};
