import { NextResponse } from "next/server";
import { downloadYtDlpToFile } from "@/lib/yt-dlp";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "yt-dlp", "downloads");
const DOWNLOADS_URL_BASE = "/yt-dlp/downloads";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");
  const rawFmt = searchParams.get("format");

  if (!v) {
    return NextResponse.json({ error: "Missing 'v' parameter" }, { status: 400 });
  }
  if (!rawFmt) {
    return NextResponse.json({ error: "Missing 'format' parameter" }, { status: 400 });
  }

  // Parse video URL or ID
  const videoUrl = /^https?:/.test(v) ? v : `https://www.youtube.com/watch?v=${v}`;
  const fmt = rawFmt.replace(/ /g, "+");
  // Validate format
  let formatArg: string;
  if (fmt === "best") {
    formatArg = "bestvideo+bestaudio";
  } else if (/^[A-Za-z0-9_-]+\+[A-Za-z0-9_-]+$/.test(fmt)) {
    formatArg = fmt;
  } else {
    return NextResponse.json({ error: "Invalid format parameter" }, { status: 400 });
  }

  // Ensure download directory
  await fs.promises.mkdir(DOWNLOADS_DIR, { recursive: true });

  const baseName = `video_${v}_${Date.now()}`;
  // output with extension placeholder
  const outputTemplate = path.join(DOWNLOADS_DIR, `${baseName}.%(ext)s`);

  try {
    await downloadYtDlpToFile(formatArg, outputTemplate, videoUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Find actual file
  const files = await fs.promises.readdir(DOWNLOADS_DIR);
  const matched = files.find((f) => f.startsWith(`${baseName}.`));
  if (!matched) {
    return NextResponse.json({ error: "Downloaded file not found" }, { status: 500 });
  }

  // Determine base URL
  const baseUrl = process.env.BASE_URL || request.headers.get("host");
  const downloadUrl = `${baseUrl}${DOWNLOADS_URL_BASE}/${matched}`;

  return NextResponse.json({ downloadUrl });
}
