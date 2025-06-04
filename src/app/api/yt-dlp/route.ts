export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");

  if (!v) {
    return NextResponse.json({ error: "Missing v parameter" }, { status: 400 });
  }

  let videoUrl: string;
  if (/^https?:\/\//.test(v)) {
    let parsed: URL;

    try {
      parsed = new URL(v);
    } catch {
      return NextResponse.json({ error: "Invalid URL format for v parameter" }, { status: 400 });
    }

    const host = parsed.hostname.replace(/^www\./, "");
    if (!["youtube.com", "youtu.be"].includes(host)) {
      return NextResponse.json(
        { error: "v parameter must be a YouTube URL or ID" },
        { status: 400 }
      );
    }

    videoUrl = v;

  } else {
    const idRegex = /^[A-Za-z0-9_-]{11}$/;
    if (!idRegex.test(v)) {
      return NextResponse.json(
        { error: "v parameter must be a valid YouTube video ID" },
        { status: 400 }
      );
    }
    videoUrl = `https://www.youtube.com/watch?v=${v}`;
  }

  const args = ["-J", videoUrl];

  try {
    const info = await new Promise<any>((resolve, reject) => {
      const proc = spawn("yt-dlp", args);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      proc.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      proc.on("close", (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(stdout);
          }
        } else {
          reject(new Error(stderr || stdout));
        }
      });
    });

    return NextResponse.json({ info });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
