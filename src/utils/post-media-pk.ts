import type { Media } from "../types/index.js";
import { extractMediaPkFromHtml } from "./media-id.js";
import { shortcodeToMediaPk } from "./shortcode.js";

/** PK candidates for post media/info (carousel needs parent id, not a child cache key). */
export function postMediaPkCandidates(
  shortcode: string,
  html = "",
  media: Media[] = []
): string[] {
  const seen = new Set<string>();
  const add = (pk: string | null | undefined) => {
    if (pk && !seen.has(pk)) {
      seen.add(pk);
      return pk;
    }
    return null;
  };

  const out: string[] = [];
  const fromShortcode = add(shortcodeToMediaPk(shortcode));
  if (fromShortcode) {
    out.push(fromShortcode);
    return out;
  }

  const fromHtml = add(extractMediaPkFromHtml(html));
  if (fromHtml) out.push(fromHtml);

  for (const item of media) {
    const fromUrl = add(extractMediaPkFromHtml(item.url));
    if (fromUrl) out.push(fromUrl);
  }

  return out;
}