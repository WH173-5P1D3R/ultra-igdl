import type { Media } from "../types/index.js";
import { enrichImageDimensions } from "./media-dimensions.js";

export function isValidMediaUrl(url: string): boolean {
  if (!isCdnMediaUrl(url)) return false;
  if (/\.js(?:\?|$)/i.test(url) || /rsrc\.php/i.test(url)) return false;
  if (/static\.cdninstagram\.com/i.test(url)) return false;
  return true;
}

export function filterValidMedia(media: Media[]): Media[] {
  return media.filter((m) => isValidMediaUrl(m.url));
}

/**
 * Keep CDN URLs unchanged — Instagram signs query params; editing them causes
 * "URL signature mismatch" (403) when downloading.
 */
export function upgradeImageUrl(url: string): string {
  return url;
}

export function dimensionsFromImageUrl(url: string): { width?: number; height?: number } {
  const crop = url.match(/stp=c[\d.]+?\.(\d+)\.(\d+)a/i);
  if (crop) {
    return { width: parseInt(crop[1]!, 10), height: parseInt(crop[2]!, 10) };
  }
  const size = url.match(/_s(\d+)x(\d+)_/i);
  if (size) {
    return { width: parseInt(size[1]!, 10), height: parseInt(size[2]!, 10) };
  }
  return {};
}

export function upgradeMediaItem(media: Media, html?: string): Media {
  if (media.type !== "image") return media;
  if (html) return enrichImageDimensions(media, html);
  const dims = dimensionsFromImageUrl(media.url);
  return {
    ...media,
    url: media.url,
    width: media.width ?? dims.width,
    height: media.height ?? dims.height,
  };
}

export function isStoryProfileImage(url: string): boolean {
  return (
    /\/t51\.2885-19\//.test(url) ||
    /stp=dst-jpg_s\d+x\d+/.test(url) ||
    /profile_pic/i.test(url)
  );
}

export function isCdnMediaUrl(url: string): boolean {
  return /cdninstagram\.com|fbcdn\.net|fbsbx\.com/i.test(url);
}

export function isValidThumbnailUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (/\.js(?:\?|$)/i.test(url) || /rsrc\.php/i.test(url)) return false;
  return isCdnMediaUrl(url);
}