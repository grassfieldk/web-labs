import YtDlpWrap from "yt-dlp-wrap";

const ytDlpWrap = new YtDlpWrap();

/**
 *  Executes yt-dlp with the provided URL and format.
 *  If format is not provided, it defaults to downloading the best available format.
 *
 * @param url
 * @param format
 * @returns
 */
export const executeYtDlp = async (url: string, format?: string) => {
  const args = [url, ...(format ? ["-f", format] : []), "--merge-output-format", "mp4"];

  return ytDlpWrap.execStream(args);
};

/**
 * Fetches video metadata using yt-dlp for the given URL.
 *
 * @param url - The URL of the video to fetch metadata for.
 * @returns A promise that resolves to the video metadata.
 */
export const getYtDlpMetadata = async (url: string) => {
  const metadata = await ytDlpWrap.getVideoInfo(url);

  return metadata;
};

/**
 * Generates a file name based on video metadata and extension.
 * The format is: <video_id>_<title>.<ext>
 *
 * @param metadata
 * @param ext
 * @returns
 */
export const getFileName = (metadata: any, ext: string) => {
  const videoId = metadata.id || "unknown_id";
  // Replace characters that are invalid in file names on Windows/Linux/Mac
  const title = metadata.title
    ? metadata.title.replace(/[\\/:*?"<>|]/g, "_")
    : "unknown_title";

  return `${videoId}_${title}.${ext}`;
};
