"use client";

import { useState } from "react";

interface Format {
  id: string;
  ext: string;
  resolution: string;
  fps: number;
  size: number;
  bitrate: number;
}

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("");
  const [formats, setFormats] = useState<Format[]>([]);
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchMetadata = async () => {
    setError("");
    setIsFetching(true);
    try {
      const response = await fetch("/api/yt-dlp/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch metadata");
      }

      const data = await response.json();
      setFormats(data.formats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  const downloadVideo = async () => {
    setError("");
    setIsDownloading(true);

    try {
      const response = await fetch("/api/yt-dlp/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format }),
      });

      if (!response.ok) {
        throw new Error("Failed to download video");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      let fileName = "video.mp4";

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;\n]+)/);
        if (fileNameMatch) {
          fileName = decodeURIComponent(fileNameMatch[1]);
        } else {
          const fallbackMatch = contentDisposition.match(/filename="(.+?)"/);
          if (fallbackMatch) {
            fileName = fallbackMatch[1];
          }
        }
      }

      const blob = await response.blob();
      const link = document.createElement("a");

      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      setError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-lg p-4">
      <h1>Video Downloader</h1>
      <div>
        <label>Video URL or ID</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full"
        />
      </div>
      <button onClick={fetchMetadata} disabled={isFetching} className="w-full">
        {isFetching ? "Fetching..." : "Fetch Metadata"}
      </button>
      <label>Format (optional)</label>
      <input
        type="text"
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        className="w-full"
      />
      <button
        onClick={downloadVideo}
        disabled={isDownloading || formats.length === 0}
        className="w-full"
      >
        {isDownloading ? "Downloading..." : "Download Video"}
      </button>
      {error && <p>Error: {error}</p>}
      {formats.length > 0 && (
        <div>
          <h2>Available Formats</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Ext</th>
                <th>Resolution</th>
                <th>FPS</th>
                <th>Size (MB)</th>
                <th>Bitrate (kbps)</th>
              </tr>
            </thead>
            <tbody>
              {formats
                // .filter((format) => format.size > 0)
                .map((format) => (
                  <tr key={format.id}>
                    <td>{format.id}</td>
                    <td>{format.ext}</td>
                    <td>{format.resolution}</td>
                    <td>{format.fps}</td>
                    <td>{(format.size / (1024 * 1024)).toFixed(2)}</td>
                    <td>{(format.bitrate / 1000).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
