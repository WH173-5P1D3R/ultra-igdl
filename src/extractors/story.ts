import type { ExtractionContext, ExtractedPostData, Media } from "../types/index.js";
import { parseHtml, detectRateLimit, detectNotFound } from "../core/parser.js";
import { isStoryProfileImage } from "../utils/media-quality.js";
import { extractStoryMediaFromHtml } from "../network/instagram-api.js";

export async function extractStory(ctx: ExtractionContext): Promise<ExtractedPostData | null> {
  if (detectRateLimit(ctx.html)) {
    throw Object.assign(new Error("Rate limited"), { code: 429 });
  }
  if (detectNotFound(ctx.html, 200)) {
    return null;
  }

  const nearId = extractStoryMediaFromHtml(ctx.html, ctx.parsed.storyId);
  const parsed = parseHtml(ctx.html, "story");

  const media: Media[] = [
    ...nearId,
    ...(parsed?.media.filter((m) => !isStoryProfileImage(m.url)) ?? []),
  ];

  const seen = new Set<string>();
  const unique = media.filter((m) => {
    const k = m.url.split("?")[0]!;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!unique.length && parsed) {
    return {
      media: [],
      caption: "",
      username: ctx.parsed.username ?? "",
    };
  }

  if (!unique.length) return null;

  return {
    media: unique,
    caption: parsed?.caption ?? "",
    username: ctx.parsed.username ?? parsed?.username ?? "",
  };
}