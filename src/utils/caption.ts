import { parseInstagramDescription } from "./engagement.js";
import { normalizeCaptionText } from "./caption-normalize.js";

export {
  normalizeCaptionText,
  normalizePostCaptionText,
  unescapeCaptionEscapes,
  cleanInstagramCaptionLayout,
} from "./caption-normalize.js";

/** Instagram og:description / JSON-LD text that still includes likes/comments prefix. */
export function isEngagementPrefixedCaption(text: string): boolean {
  return (
    /^\d[\d.KMB,\s]*(?:likes?|comments?|views?)/i.test(text) &&
    /\s+on\s+[\w\s\d,.]+:\s*/i.test(text)
  );
}

/** Strip stats/username prefix when caption is still a full og:description line. */
export function captionWithoutEngagementPrefix(raw: string): string {
  const text = normalizeCaptionText(raw);
  if (!text) return "";
  if (!isEngagementPrefixedCaption(text)) return text;
  return normalizeCaptionText(parseInstagramDescription(text).caption);
}

/** Prefer the longer, non-engagement caption when multiple sources exist. */
export function pickBestCaption(...candidates: (string | undefined)[]): string {
  let best = "";
  for (const raw of candidates) {
    if (!raw) continue;
    const text = captionWithoutEngagementPrefix(raw);
    if (!text) continue;
    if (text.length > best.length) best = text;
  }
  return best;
}

/** Walk embedded JSON in page HTML for caption.text fields. */
export function scrapeCaptionFromHtml(html: string): string {
  if (!html) return "";
  const found: string[] = [];
  const patterns = [
    /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g,
    /"edge_media_to_caption"\s*:\s*\{[^}]*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      try {
        const text = JSON.parse(`"${m[1]!}"`) as string;
        if (text && !isEngagementPrefixedCaption(text)) found.push(text);
      } catch {
        /* ignore malformed escapes */
      }
    }
  }

  return pickBestCaption(...found);
}

/** Reels/posts: prefer embed UI caption (no og newline artifacts). */
export function resolveCaptionForContent(
  type: string,
  sources: {
    embed?: string;
    scraped?: string;
    extracted?: string;
    og?: string;
  }
): string {
  const embed = sources.embed ? normalizeCaptionText(sources.embed) : "";
  const scraped = sources.scraped ? captionWithoutEngagementPrefix(sources.scraped) : "";
  const extracted = sources.extracted ? captionWithoutEngagementPrefix(sources.extracted) : "";
  const og = sources.og ? captionWithoutEngagementPrefix(sources.og) : "";

  if (type === "reel" || type === "tv") {
    if (embed) return embed;
    return pickBestCaption(scraped, extracted, og);
  }
  return pickBestCaption(scraped, embed, extracted, og);
}

export function extractCaptionFromApiItem(item: Record<string, unknown>): string {
  const cap = item.caption as Record<string, unknown> | undefined;
  if (cap && typeof cap.text === "string") return normalizeCaptionText(cap.text);
  if (typeof item.caption_text === "string") return normalizeCaptionText(item.caption_text);
  return "";
}