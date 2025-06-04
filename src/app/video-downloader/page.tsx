"use client";

import { useState } from "react";

export default function VideoDownloaderPage() {
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<any>(null);
  const [format, setFormat] = useState("best");
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
          {loadingMeta ? "Loading..." : "Fetch Metadata"}
        </button>
      </div>
      {metadata && (
        <div className="mt-4">
          <h2>Metadata</h2>
          <pre className="overflow-auto rounded bg-gray-100 p-2 text-xs">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
      {metadata && (
        <div className="mt-4">
          <label className="mb-1 block">Format</label>
          <input
            type="text"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="best or formatId+formatId"
          />
          <button onClick={initiateDownload} disabled={loadingDownload}>
            {loadingDownload ? "Starting Download..." : "Download"}
          </button>
        </div>
      )}
      {downloadUrl && (
        <div className="mt-4">
          <h2>Download Link</h2>
          <a href={downloadUrl} download>
            {downloadUrl}
          </a>
        </div>
      )}
      {error && <div className="mt-4 text-red-600">Error: {error}</div>}
    </div>
  );
}
