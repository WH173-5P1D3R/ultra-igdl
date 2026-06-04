import type { ExtractionContext, ExtractedPostData } from "../types/index.js";
import { extractPost } from "./post.js";

export async function extractReel(ctx: ExtractionContext): Promise<ExtractedPostData | null> {
  return extractPost(ctx);
}