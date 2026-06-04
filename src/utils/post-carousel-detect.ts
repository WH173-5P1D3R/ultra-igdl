import type { ParsedUrl, PostContentTag, ResultTag } from "../types/index.js";

/** Instagram marks carousel/sidecar posts in embedded JSON and CDN encode tags. */
export function htmlIndicatesCarouselPost(html: string): boolean {
  if (!html) return false;
  if (/edge_sidecar_to_children/.test(html)) return true;
  if (/"carousel_media"\s*:/.test(html)) return true;
  if (/carousel_media_count/.test(html)) return true;
  if (/GraphSidecar/.test(html)) return true;
  if (/CAROUSEL_ITEM/.test(html)) return true;
  if (/media_type["\s]*:["\s]*8\b/.test(html)) return true;
  if (/product_type["\s]*:["\s]*carousel/.test(html)) return true;
  return false;
}

export function buildPostContentTags(
  parsedType: ParsedUrl["type"],
  mediaCount: number,
  html: string,
  hasSession: boolean
): PostContentTag[] {
  if (parsedType !== "post") return [];
  if (mediaCount > 1) return ["carousel"];
  if (!htmlIndicatesCarouselPost(html)) return [];
  const tags: PostContentTag[] = ["partial_carousel"];
  if (!hasSession) tags.push("session_recommended");
  return tags;
}

export function mergeResultTags(
  existing: ResultTag[] | undefined,
  content: PostContentTag[]
): ResultTag[] | undefined {
  const merged = [...new Set<ResultTag>([...(existing ?? []), ...content])];
  return merged.length ? merged : undefined;
}