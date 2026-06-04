import type { ExtractionContext, ExtractedPostData, ParsedUrl } from "../types/index.js";
import { extractReel } from "../extractors/reel.js";
import { extractPost } from "../extractors/post.js";
import { extractStory } from "../extractors/story.js";
import { extractHighlight } from "../extractors/highlight.js";

export async function runExtractor(ctx: ExtractionContext): Promise<ExtractedPostData | null> {
  const { parsed } = ctx;

  switch (parsed.type) {
    case "reel":
    case "tv":
      return extractReel(ctx);
    case "post":
      return extractPost(ctx);
    case "story":
      return extractStory(ctx);
    case "highlight":
      return extractHighlight(ctx);
    default:
      return extractPost(ctx);
  }
}

export function resolveFetchUrl(parsed: ParsedUrl): string {
  if (parsed.type === "story" && parsed.username && !parsed.storyId) {
    return `https://www.instagram.com/stories/${parsed.username}/`;
  }
  return parsed.normalized;
}

export function resolveEmbedUrl(parsed: ParsedUrl): string | null {
  if (!parsed.shortcode) return null;
  if (parsed.type === "reel") {
    return `https://www.instagram.com/reel/${parsed.shortcode}/embed/`;
  }
  if (parsed.type === "post") {
    return `https://www.instagram.com/p/${parsed.shortcode}/embed/`;
  }
  if (parsed.type === "tv") {
    return `https://www.instagram.com/tv/${parsed.shortcode}/embed/`;
  }
  return null;
}

export function resolveStoryEmbedUrl(parsed: ParsedUrl): string | null {
  if (parsed.type !== "story" || !parsed.username || !parsed.storyId) return null;
  return `https://www.instagram.com/stories/${parsed.username}/${parsed.storyId}/embed/`;
}