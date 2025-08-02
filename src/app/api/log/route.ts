import { NextResponse } from "next/server";
import type { LogLevel } from "@/types/LogLevel";
import { log } from "@/utils/logger.client";

type LogRequestBody = {
  filePath: string;
  level: LogLevel;
  message: string;
};

export async function POST(req: Request) {
  try {
    const body: LogRequestBody = await req.json();

    if (!body.filePath || !body.level || !body.message) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    log(body.level, body.filePath, body.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to write to log file:", err);
    return NextResponse.json({ error: "Failed to write to log file" }, { status: 500 });
  }
}
