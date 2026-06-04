import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { request } from "../network/request.js";
import type { Media } from "../types/index.js";
import { buildCdnDownloadHeaders } from "../network/headers.js";
import { getAgent } from "../network/pool.js";

export interface FileDownloadOptions {
  outputDir: string;
  onProgress?: (info: ProgressInfo) => void;
  retries?: number;
}

export interface ProgressInfo {
  filename: string;
  downloaded: number;
  total: number;
  speed: number;
}

export function generateFilename(media: Media, index: number): string {
  const ext = media.type === "video" ? ".mp4" : extname(new URL(media.url).pathname) || ".jpg";
  const base = `${media.type}_${index + 1}_${Date.now()}`;
  return `${base}${ext.startsWith(".") ? ext : `.${ext}`}`;
}

export async function downloadMediaFile(
  media: Media,
  outputPath: string,
  retries = 3
): Promise<{ path: string; size: number; durationMs: number }> {
  const start = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      const response = await request(media.url, {
        method: "GET",
        headers: buildCdnDownloadHeaders(media.url),
        dispatcher: getAgent(),
      });

      if (response.statusCode >= 400) {
        const hint =
          response.statusCode === 403
            ? " (URL signature mismatch — media URL may be expired; re-fetch the post)"
            : "";
        throw new Error(`HTTP ${response.statusCode}${hint}`);
      }

      const contentLength = parseInt(
        String(response.headers["content-length"] ?? "0"),
        10
      );
      let downloaded = 0;

      const writeStream = createWriteStream(outputPath);
      for await (const chunk of response.body) {
        downloaded += chunk.length;
        writeStream.write(chunk);
      }
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const fileStat = await stat(outputPath);
      return {
        path: outputPath,
        size: fileStat.size || contentLength || downloaded,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function downloadAllMedia(
  mediaList: Media[],
  options: FileDownloadOptions
): Promise<Array<{ path: string; size: number }>> {
  const results: Array<{ path: string; size: number }> = [];

  for (let i = 0; i < mediaList.length; i++) {
    const media = mediaList[i]!;
    const filename = generateFilename(media, i);
    const outputPath = join(options.outputDir, filename);
    const result = await downloadMediaFile(media, outputPath, options.retries);
    results.push({ path: result.path, size: result.size });
    options.onProgress?.({
      filename,
      downloaded: result.size,
      total: result.size,
      speed: result.size / (result.durationMs / 1000),
    });
  }

  return results;
}