import { executeYtDlp, getFileName, getYtDlpMetadata } from "@/services/yt-dlp/ytDlpHelper";
import { NextResponse } from "next/server";
import { PassThrough } from "stream";

export async function POST(request: Request) {
  try {
    const { url, format } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const metadata = await getYtDlpMetadata(url);
    const fileName = getFileName(metadata, format?.split("+")[0] || "mp4");

    const ytDlpStream = await executeYtDlp(url, format);

    const passThrough = new PassThrough();
    ytDlpStream.pipe(passThrough);

    ytDlpStream.on("error", (err) => {
      console.error("yt-dlp error:", err.message || err);
      passThrough.destroy(err);
    });

    const readableStream = new ReadableStream({
      start(controller) {
        passThrough.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        passThrough.on("end", () => {
          controller.close();
        });
        passThrough.on("error", (err) => {
          console.error("Stream error:", err.message || err);
          controller.error(err);
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
