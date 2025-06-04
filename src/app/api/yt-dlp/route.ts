export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Endpoints:",
    metadata: "/api/yt-dlp/metadata?v=<videoUrl or ID>",
    download: "/api/yt-dlp/download?v=<videoUrl or ID>&format=<format>",
  });
}
