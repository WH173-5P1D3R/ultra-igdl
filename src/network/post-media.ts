import type { Media } from "../types/index.js";
import { request } from "./request.js";
import { buildInstagramPageHeaders } from "./headers.js";
import { dimensionsFromImageUrl, isValidMediaUrl } from "../utils/media-quality.js";
import { isLowResDeliveryUrl } from "../utils/media-dimensions.js";

const REDIRECT_TIMEOUT_MS = 6_000;

function dimensionsFromRedirectUrl(url: string): { width?: number; height?: number } {
  const p = url.match(/p(\d+)x(\d+)/i);
  if (p) {
    return { width: parseInt(p[1]!, 10), height: parseInt(p[2]!, 10) };
  }
  return dimensionsFromImageUrl(url);
}

/** Instagram 302 to a signed CDN URL (typically p1080, no s640 token). */
export async function fetchPostLargeImageUrl(
  shortcode: string,
  timeoutMs = REDIRECT_TIMEOUT_MS
): Promise<{ url: string; width?: number; height?: number } | null> {
  const pageUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(pageUrl, {
      method: "GET",
      headers: buildInstagramPageHeaders(),
      signal: controller.signal,
      // undici supports this; @types omit maxRedirections on RequestOptions
      maxRedirections: 0,
    } as Parameters<typeof request>[1]);
    await response.body.text();

    if (response.statusCode !== 301 && response.statusCode !== 302) return null;
    const raw = response.headers.location;
    const target = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (
      !target ||
      !isValidMediaUrl(target) ||
      isLowResDeliveryUrl(target) ||
      !/\.(jpe?g|webp|png)/i.test(target.split("?")[0] ?? "")
    ) {
      return null;
    }

    return { url: target, ...dimensionsFromRedirectUrl(target) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function applyLargePostImage(
  media: Media[],
  large: { url: string; width?: number; height?: number }
): Media[] {
  if (!isValidMediaUrl(large.url)) return media;
  const multiImage = media.filter((m) => m.type === "image").length > 1;
  let firstImageUpgraded = false;
  return media.map((item) => {
    if (item.type !== "image") return item;
    if (multiImage && firstImageUpgraded) return item;
    const fromUrl = dimensionsFromImageUrl(item.url);
    const width = Math.max(item.width ?? 0, large.width ?? 0, fromUrl.width ?? 0) || item.width;
    const height = Math.max(item.height ?? 0, large.height ?? 0, fromUrl.height ?? 0) || item.height;
    firstImageUpgraded = true;
    return { ...item, url: large.url, width, height };
  });
}