"use client";

import { useState } from "react";

export default function VideoDownloaderPage() {
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<any>(null);
  const [format, setFormat] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);

  const requestPath = "/api/yt-dlp";

  const fetchMetadata = async () => {
    setError(null);
    setLoadingMeta(true);
    setMetadata(null);
    try {
      const res = await fetch(`${requestPath}/metadata?v=${encodeURIComponent(videoId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch metadata");
      setMetadata(data.info);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const initiateDownload = async () => {
    setError(null);
    setLoadingDownload(true);
    setDownloadUrl(null);
    try {
      const res = await fetch(
        `${requestPath}/download?v=${encodeURIComponent(videoId)}&format=${encodeURIComponent(format)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate download");
      setDownloadUrl(data.downloadUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 pt-6">
      <h1>YouTube Video Downloader</h1>
      <div className="mb-4">
        <label>Video URL or ID</label>
        <input
          type="text"
          className="w-full"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
        <button onClick={fetchMetadata} disabled={loadingMeta || !videoId}>
          {loadingMeta ? "Loading..." : "Fetch Video Info"}
        </button>
      </div>
      {metadata && (
        <div className="mt-4">
          <label>Format</label>
          <input
            type="text"
            className="w-full"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          />
          <button onClick={initiateDownload} disabled={loadingDownload}>
            {loadingDownload ? "Getting Link..." : "Get Download Link"}
          </button>
          {downloadUrl && (
            <a href={downloadUrl} download>
              {downloadUrl}
            </a>
          )}
        </div>
      )}
      {metadata && (
        <div className="mt-4">
          <h2>Available Formats</h2>
          <div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-800 text-white">
                <tr>
                  <th className="px-3 py-1">ID</th>
                  <th className="px-3 py-1">Ext</th>
                  <th className="px-3 py-1">Resolution</th>
                  <th className="px-3 py-1">FPS</th>
                  <th className="px-3 py-1">Size</th>
                  <th className="hidden px-3 py-1 sm:table-cell">Bitrate</th>
                </tr>
              </thead>
              <tbody>
                {metadata.formats
                  ?.filter((fmt: any) => fmt.ext !== "mhtml")
                  .map((fmt: any) => (
                    <tr key={fmt.format_id} className="border-b">
                      <td className="px-3 py-1">{fmt.format_id}</td>
                      <td className="px-3 py-1">{fmt.ext}</td>
                      <td className="px-3 py-1">
                        {fmt.vcodec === "none"
                          ? "(AUDIO)"
                          : fmt.width && fmt.height
                            ? `${fmt.width}x${fmt.height}`
                            : fmt.format}
                      </td>
                      <td className="px-3 py-1">{fmt.fps ?? "-"}</td>
                      <td className="px-3 py-1">
                        {fmt.filesize
                          ? `${(fmt.filesize / (1024 * 1024)).toFixed(1)} MB`
                          : fmt.filesize_approx
                            ? `${(fmt.filesize_approx / (1024 * 1024)).toFixed(1)} MB`
                            : "-"}
                      </td>
                      <td className="hidden px-3 py-1 sm:table-cell">
                        {fmt.tbr ? `${Math.round(fmt.tbr)} kbps` : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && <div className="mt-4 text-red-600">Error: {error}</div>}
    </div>
  );
}
