"use client";

import {
  Alert,
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { MdError } from "react-icons/md";

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
  const [format, setFormat] = useState<string | null>("");
  const [formats, setFormats] = useState<Format[]>([]);
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchMetadata = async () => {
    setError("");
    setIsFetching(true);
    try {
      const params = new URLSearchParams({ url });
      const response = await fetch(`/api/yt-dlp/metadata?${params.toString()}`);

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
      const params = new URLSearchParams({ url, format: format || "" });
      const response = await fetch(`/api/yt-dlp/download?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to download video");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      let fileName = "video.mp4";

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(
          /filename\*=(?:UTF-8'')?([^;\n]+)/
        );
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
    <Stack gap="lg">
      <div>
        <Title order={1}>Video Downloader</Title>
        <Text c="dimmed" size="sm" mt="xs">
          Supported sites are based on yt-dlp. See:{" "}
          <a
            href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
            target="_blank"
            rel="noopener"
            style={{ color: "var(--mantine-color-blue-6)" }}
          >
            https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md
          </a>
        </Text>
      </div>

      <TextInput
        label="Video URL or ID"
        placeholder="Enter video URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <Group grow>
        <Button onClick={fetchMetadata} loading={isFetching}>
          Fetch Metadata
        </Button>
        <Button onClick={downloadVideo} loading={isDownloading} color="green">
          Download Video
        </Button>
      </Group>

      <TextInput
        label="Format (optional)"
        placeholder="Leave empty to use default format"
        value={format || ""}
        onChange={(e) => setFormat(e.target.value)}
      />

      {error && (
        <Alert icon={<MdError size={16} />} color="red" title="Error">
          {error}
        </Alert>
      )}

      {formats.length > 0 && (
        <div>
          <Title order={2} size="h3" mb="md">
            Available Formats
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Ext</Table.Th>
                <Table.Th>Resolution</Table.Th>
                <Table.Th>FPS</Table.Th>
                <Table.Th>Size (MB)</Table.Th>
                <Table.Th>Bitrate (kbps)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {formats.map((fmt) => (
                <Table.Tr key={fmt.id}>
                  <Table.Td>{fmt.id}</Table.Td>
                  <Table.Td>{fmt.ext}</Table.Td>
                  <Table.Td>{fmt.resolution}</Table.Td>
                  <Table.Td>{fmt.fps}</Table.Td>
                  <Table.Td>{(fmt.size / (1024 * 1024)).toFixed(2)}</Table.Td>
                  <Table.Td>{(fmt.bitrate / 1000).toFixed(2)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
}
