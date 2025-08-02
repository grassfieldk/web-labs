import { getYtDlpMetadata } from "@/services/yt-dlp/ytDlpHelper";
import { NextResponse } from "next/server";

interface Format {
  format_id: string;
  ext: string;
  height?: number;
  fps?: number;
  filesize?: number;
  tbr?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const metadata = await getYtDlpMetadata(url);

    const formats = (metadata.formats as Format[]).map((format) => ({
      id: format.format_id,
      ext: format.ext,
      resolution: format.height ? `${format.height}p` : "audio only",
      fps: format.fps || 0,
      size: format.filesize || 0,
      bitrate: format.tbr || 0,
    }));

    return NextResponse.json({ formats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
