import type { ExtractionContext, ExtractedPostData, Media } from "../types/index.js";
import { parseHtml, detectRateLimit, detectNotFound, decodeEscapedUrl } from "../core/parser.js";
import { enrichImageDimensions } from "../utils/media-dimensions.js";

function parseMediaBlock(chunk: string): Media | null {
  const isVideo = /"media_type":\s*2/.test(chunk) || /"is_video":\s*true/.test(chunk);
  if (isVideo) {
    const videoRe = /"video_versions":\s*\[[^\]]*?"width":\s*(\d+)[^}]*"height":\s*(\d+)[^}]*"url":\s*"([^"]+)"/;
    const vm = chunk.match(videoRe);
    if (vm) {
      return {
        type: "video",
        url: decodeEscapedUrl(vm[3]!.replace(/\\u0026/g, "&").replace(/\\\//g, "/")),
        width: parseInt(vm[1]!, 10),
        height: parseInt(vm[2]!, 10),
      };
    }
    const urlOnly = /"video_versions":\[[^\]]*?"url":"([^"]+)"/.exec(chunk);
    if (urlOnly) {
      return {
        type: "video",
        url: decodeEscapedUrl(urlOnly[1]!.replace(/\\u0026/g, "&").replace(/\\\//g, "/")),
      };
    }
  }

  const imgRe =
    /"image_versions2":\s*\{\s*"candidates":\s*\[[^\]]*?"width":\s*(\d+)\s*,\s*"height":\s*(\d+)[^}]*"url":\s*"([^"]+)"/;
  const im = chunk.match(imgRe);
  if (im) {
    return {
      type: "image",
      url: decodeEscapedUrl(im[3]!.replace(/\\u0026/g, "&").replace(/\\\//g, "/")),
      width: parseInt(im[1]!, 10),
      height: parseInt(im[2]!, 10),
    };
  }
  return null;
}

function extractNearMediaId(html: string, storyMediaId?: string): Media[] {
  const pk = storyMediaId?.split("_")[0];
  if (!pk) return [];
  const media: Media[] = [];
  let pos = 0;
  while ((pos = html.indexOf(pk, pos)) !== -1 && media.length < 8) {
    const chunk = html.slice(Math.max(0, pos - 14000), pos + 18000);
    const item = parseMediaBlock(chunk);
    if (item && !media.some((m) => m.url === item.url)) {
      media.push(item);
    }
    pos += pk.length;
  }
  return media;
}

function dedupeMediaList(media: Media[]): Media[] {
  const seen = new Set<string>();
  return media.filter((m) => {
    const k = m.url.split("?")[0]!;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function extractHighlight(ctx: ExtractionContext): Promise<ExtractedPostData | null> {
  if (detectRateLimit(ctx.html)) {
    throw Object.assign(new Error("Rate limited"), { code: 429 });
  }
  if (detectNotFound(ctx.html, 200)) {
    return null;
  }

  const parsed = parseHtml(ctx.html, "highlight");
  const allMedia: Media[] = [];

  allMedia.push(...extractNearMediaId(ctx.html, ctx.parsed.storyMediaId));
  if (parsed?.media.length) {
    allMedia.push(...parsed.media);
  }

  const itemRegex = /"media_type":\s*(\d+)[\s\S]{0,4000}?(?="media_type":|$)/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(ctx.html)) !== null) {
    const block = match[0]!;
    const item = parseMediaBlock(block);
    if (item && !allMedia.some((m) => m.url === item.url)) {
      allMedia.push(item);
    }
  }

  const unique = dedupeMediaList(allMedia).map((m) =>
    m.type === "image" ? enrichImageDimensions(m, ctx.html) : m
  );

  if (!unique.length) return parsed;

  return {
    media: unique,
    caption: parsed?.caption ?? "",
    username: ctx.parsed.username ?? parsed?.username ?? "",
  };
}