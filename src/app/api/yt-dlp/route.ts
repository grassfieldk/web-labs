export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// constants for download storage and URL
const DOWNLOADS_DIR = path.join(process.cwd(), "public", "yt-dlp", "downloads");
const DOWNLOADS_URL_BASE = "/yt-dlp/downloads";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");

  if (!v) {
    return NextResponse.json({ error: "Missing v parameter" }, { status: 400 });
  }

  const videoUrl = /^https?:\/\//.test(v) ? v : `https://www.youtube.com/watch?v=${v}`;

  // Download handling: if the 'format' query is provided, generate download link
  const rawFmt = searchParams.get("format");
  if (rawFmt) {
    // Decode '+' from spaces and validate format parameter
    const fmt = rawFmt.replace(/ /g, "+");

    let formatArg = "";
    if (fmt === "best") {
      formatArg = "bestvideo+bestaudio";
    } else if (/^[A-Za-z0-9_-]+\+[A-Za-z0-9_-]+$/.test(fmt)) {
      formatArg = fmt;
    } else {
      return NextResponse.json({ error: "Invalid format parameter" }, { status: 400 });
    }

    // Ensure api-specific download folder
    await fs.promises.mkdir(DOWNLOADS_DIR, { recursive: true });

    // Create unique base name and output template
    const baseName = `video_${v}_${Date.now()}`;
    const outputTemplate = path.join(DOWNLOADS_DIR, `${baseName}.%(ext)s`);

    // Run yt-dlp to download file with extension based on format
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("yt-dlp", ["-q", "-f", formatArg, "-o", outputTemplate, videoUrl]);
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });
    });

    // After download, find actual file with its extension
    const files = await fs.promises.readdir(DOWNLOADS_DIR);
    const matched = files.find(f => f.startsWith(`${baseName}.`));
    if (!matched) {
      return NextResponse.json({ error: "Downloaded file not found" }, { status: 500 });
    }
    const filename = matched;
    // determine base URL from env or request origin
    const baseUrl = process.env.BASE_URL || new URL(request.url).origin;
    const downloadUrl = `${baseUrl}${DOWNLOADS_URL_BASE}/${filename}`;
    return NextResponse.json({ downloadUrl });
  }

  // Fetch metadata
  const args = ["-J", videoUrl];

  try {
    const info = await new Promise<any>((resolve, reject) => {
      const proc = spawn("yt-dlp", ["-q", ...args]);

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
