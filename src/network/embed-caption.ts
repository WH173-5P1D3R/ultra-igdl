import * as cheerio from "cheerio";
import type { ParsedUrl } from "../types/index.js";
import { normalizeCaptionText } from "../utils/caption-normalize.js";

export function captionedEmbedUrl(parsed: ParsedUrl): string | null {
  if (!parsed.shortcode) return null;
  const segment =
    parsed.type === "reel" ? "reel" : parsed.type === "tv" ? "tv" : "p";
  return `https://www.instagram.com/${segment}/${parsed.shortcode}/embed/captioned/`;
}

/** Caption text as shown on Instagram embed (single block, includes emoji). */
export function parseCaptionFromCaptionedEmbed(
  html: string,
  contentType: ParsedUrl["type"] = "reel"
): string {
  const $ = cheerio.load(html);
  const block = $(".Caption").first().text().trim();
  if (!block) return "";

  const user = $(".CaptionUsername").first().text().trim();
  let caption = block;
  if (user && caption.startsWith(user)) {
    caption = caption.slice(user.length);
  }
  caption = caption.replace(/View all [\d,.]+[KMB]?\s+comments?.*$/i, "").trim();

  if (contentType === "post") {
    caption = caption.replace(/\n{3,}/g, "\n\n").trim();
  } else {
    caption = caption.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  }

  return normalizeCaptionText(caption);
}

export function contentTypesWithEmbedCaption(type: ParsedUrl["type"]): boolean {
  return type === "reel" || type === "post" || type === "tv";
}