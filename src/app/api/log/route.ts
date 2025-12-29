import { NextResponse } from "next/server";
import type { LogLevel } from "@/types/LogLevel";
import { log } from "@/utils/logger.server"

type LogRequestBody = {
  app: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const body: LogRequestBody = await req.json();

    if (!body.app || !body.level || !body.message) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    switch (body.level) {
      case "DEBUG":
        log.debug(body.app, body.message, body.context);
        break;
      case "INFO":
        log.info(body.app, body.message, body.context);
        break;
      case "WARN":
        log.warn(body.app, body.message, body.context);
        break;
      case "ERROR":
        log.error(body.app, body.message, body.context);
        break;
      default:
        log.info(body.app, body.message, body.context);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        app: "system",
        message: "Failed to process log request",
        context: { error: String(err) },
      })
    );
    return NextResponse.json({ error: "Failed to process log request" }, { status: 500 });
  }
}
