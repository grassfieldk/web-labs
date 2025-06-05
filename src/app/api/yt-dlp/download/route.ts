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
  const format = searchParams.get("format")?.replace(/ /g, "+");

  // Validate parameters
  if (!v) {
    return NextResponse.json({ error: "Missing 'v' parameter" }, { status: 400 });
  }
  if (!format) {
    return NextResponse.json({ error: "Missing 'format' parameter" }, { status: 400 });
  }

  console.log(`Downloading video: ${v} with format: ${format}`);

  // Normalize video URL or ID
  const decodedV = decodeURIComponent(v);
  const isUrl = decodedV.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  const videoId = isUrl ? isUrl[1] : decodedV;

  console.log(`Normalized video ID: ${videoId}`);

  // Validate YouTube video ID
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Invalid YouTube video ID" }, { status: 400 });
  }

  // Determine format argument
  let formatArg: string;
  if (format === "best") {
    formatArg = "bestvideo+bestaudio";
  } else if (/^[A-Za-z0-9_-]+\+[A-Za-z0-9_-]+$/.test(format)) {
    formatArg = format;
  } else {
    return NextResponse.json({ error: "Invalid format parameter" }, { status: 400 });
  }

  // Ensure downloads directory exists
  await fs.promises.mkdir(DOWNLOADS_DIR, { recursive: true });

  // Generate output file name
  const baseName = `video_${videoId}_${Date.now()}`;
  const outputTemplate = path.join(DOWNLOADS_DIR, `${baseName}.%(ext)s`);

  try {
    await downloadYtDlpToFile(formatArg, outputTemplate, videoId);
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
