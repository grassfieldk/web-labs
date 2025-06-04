import { NextResponse } from "next/server";
import { runYtDlpJson } from "../../../../lib/yt-dlp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");
  if (!v) {
    return NextResponse.json({ error: "Missing v parameter" }, { status: 400 });
  }

  const videoUrl = /^https?:/.test(v) ? v : `https://www.youtube.com/watch?v=${v}`;
  try {
    const info = await runYtDlpJson([videoUrl]);
    return NextResponse.json({ info });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
