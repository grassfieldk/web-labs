import { spawn } from "child_process";

/**
 * Execute yt-dlp with the given args and parse JSON output
 */
export async function runYtDlpJson(args: string[]): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("yt-dlp", ["-q", "-J", ...args]);
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
          reject(new Error("Invalid JSON output"));
        }
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

/**
 * Download video via yt-dlp to specified file path with given format
 */
export async function downloadYtDlpToFile(
  formatArg: string,
  outputPath: string,
  videoUrl: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn("yt-dlp", ["-q", "-f", formatArg, "-o", outputPath, videoUrl]);
    let err = "";
    proc.stderr.on("data", (chunk) => {
      err += chunk;
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `yt-dlp exited with code ${code}`));
    });
  });
}
