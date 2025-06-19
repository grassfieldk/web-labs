import { LogLevel } from "@/types/LogLevel";
import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";

type LogRequestBody = {
  filePath: string;
  level: LogLevel;
  message: string;
};

function getJSTTimestamp(): string {
  const now = new Date();
  now.setHours(now.getHours() + 9); // JST (UTC+9) に変換
  return now.toISOString().replace("T", " ").replace("Z", "");
}

function writeLogSync(filePath: string, level: string, message: string) {
  const logEntry = `[${getJSTTimestamp()}] [${level}] ${message}\n`;
  const absolutePath = path.resolve(process.cwd(), filePath);

  fs.appendFileSync(absolutePath, logEntry, "utf8");
}

export async function POST(req: Request) {
  try {
    const body: LogRequestBody = await req.json();

    if (!body.filePath || !body.level || !body.message) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    writeLogSync(body.filePath, body.level, body.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to write to log file:", err);
    return NextResponse.json({ error: "Failed to write to log file" }, { status: 500 });
  }
}
