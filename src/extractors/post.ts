import type { ExtractionContext, ExtractedPostData } from "../types/index.js";
import { parseHtml, detectNotFound, detectRateLimit } from "../core/parser.js";

export async function extractPost(ctx: ExtractionContext): Promise<ExtractedPostData | null> {
  if (detectRateLimit(ctx.html)) {
    throw Object.assign(new Error("Rate limited"), { code: 429 });
  }
  if (detectNotFound(ctx.html, 200)) {
    return null;
  }
  return parseHtml(ctx.html, ctx.parsed.type);
}