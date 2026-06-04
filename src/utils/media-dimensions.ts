import type { Media } from "../types/index.js";
import { decodeEscapedUrl } from "../core/parser.js";
import {
  dimensionsFromImageUrl,
  isValidMediaUrl,
} from "./media-quality.js";

export interface ImageCandidate {
  url: string;
  width: number;
  height: number;
}

/** Largest original_width / original_height pair embedded in Instagram HTML/JSON. */
export function maxOriginalDimensionsFromHtml(html: string): {
  width?: number;
  height?: number;
} {
  let bestArea = 0;
  let width: number | undefined;
  let height: number | undefined;

  const patterns = [
    /"original_width":\s*(\d+)\s*,\s*"original_height":\s*(\d+)/g,
    /"original_width":(\d+),"original_height":(\d+)/g,
    /original_width\\":(\d+),\\"original_height\\":(\d+)/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const w = parseInt(m[1]!, 10);
      const h = parseInt(m[2]!, 10);
      const area = w * h;
      if (area > bestArea) {
        bestArea = area;
        width = w;
        height = h;
      }
    }
  }

  return { width, height };
}

/** Collect image_versions2 / display_resources candidates from raw HTML. */
export function scrapeImageCandidates(html: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  const add = (url: string, w: number, h: number) => {
    const decoded = decodeEscapedUrl(url.replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
    if (!decoded.startsWith("http")) return;
    const key = decoded.split("?")[0]!;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ url: decoded, width: w, height: h });
  };

  const iv2 =
    /"width":\s*(\d+)\s*,\s*"height":\s*(\d+)[\s\S]*?"url":\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = iv2.exec(html)) !== null) {
    add(m[3]!, parseInt(m[1]!, 10), parseInt(m[2]!, 10));
  }

  const iv2t =
    /"url":\s*"([^"]+)"[\s\S]*?"width":\s*(\d+)\s*,\s*"height":\s*(\d+)/g;
  while ((m = iv2t.exec(html)) !== null) {
    add(m[1]!, parseInt(m[2]!, 10), parseInt(m[3]!, 10));
  }

  const resources =
    /"config_width":\s*(\d+)\s*,\s*"config_height":\s*(\d+)[^}]*"src":\s*"([^"]+)"/g;
  while ((m = resources.exec(html)) !== null) {
    add(m[3]!, parseInt(m[1]!, 10), parseInt(m[2]!, 10));
  }

  const displayUrl =
    /"display_url":\s*"([^"]+)"[\s\S]{0,400}?"original_width":\s*(\d+)\s*,\s*"original_height":\s*(\d+)/g;
  while ((m = displayUrl.exec(html)) !== null) {
    add(m[1]!, parseInt(m[2]!, 10), parseInt(m[3]!, 10));
  }

  return candidates;
}

function mediaAssetKey(url: string): string | null {
  const m = url.match(/\/(\d+)_(\d+)_/);
  return m ? `${m[1]}_${m[2]}` : null;
}

export function isLowResDeliveryUrl(url: string): boolean {
  return /_s640x640|_s\d{3}x\d{3}_|e\d+_s640x640/i.test(url);
}

export function bestImageCandidate(html: string): ImageCandidate | null {
  const candidates = scrapeImageCandidates(html);
  if (!candidates.length) return null;
  return pickLargestCandidate(candidates);
}

export function bestImageCandidateForMedia(
  html: string,
  mediaUrl: string
): ImageCandidate | null {
  const candidates = scrapeImageCandidates(html);
  if (!candidates.length) return null;

  const key = mediaAssetKey(mediaUrl);
  if (key) {
    const matched = candidates.filter((c) => c.url.includes(key));
    if (matched.length) return pickLargestCandidate(matched);
  }

  return pickLargestCandidate(candidates);
}

function pickLargestCandidate(candidates: ImageCandidate[]): ImageCandidate {
  const valid = candidates.filter((c) => isValidMediaUrl(c.url));
  const pool = valid.length ? valid : candidates;
  const sorted = [...pool].sort((a, b) => b.width * b.height - a.width * a.height);
  const withoutLow = sorted.find((c) => !isLowResDeliveryUrl(c.url));
  return withoutLow ?? sorted[0]!;
}

function scrapeAssetUrlsFromHtml(html: string, assetKey: string): string[] {
  const urls: string[] = [];
  const patterns = [
    new RegExp(`"(https?:[^"]*${assetKey}[^"]*)"`, "gi"),
    new RegExp(`(https?:\\\\/\\\\/[^"\\\\]*${assetKey}[^"\\\\]*)`, "gi"),
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const decoded = decodeEscapedUrl(m[1]!);
      if (isValidMediaUrl(decoded)) urls.push(decoded);
    }
  }
  return urls;
}

export function enrichImageDimensions(media: Media, html: string): Media {
  if (media.type !== "image") return media;

  const best = bestImageCandidateForMedia(html, media.url);
  const fromOriginal = maxOriginalDimensionsFromHtml(html);
  const fromStp = dimensionsFromImageUrl(media.url);

  let width = media.width;
  let height = media.height;
  let url = media.url;

  const apply = (w?: number, h?: number, candidateUrl?: string) => {
    if (!w || !h) return;
    const area = w * h;
    const cur = (width ?? 0) * (height ?? 0);
    const urlArea = dimensionsFromImageUrl(url);
    const curUrlArea = (urlArea.width ?? 0) * (urlArea.height ?? 0);
    const betterDims = area > cur;
    const betterUrl =
      candidateUrl &&
      (!isLowResDeliveryUrl(candidateUrl) ||
        (isLowResDeliveryUrl(url) && area >= curUrlArea));
    if (betterDims) {
      width = w;
      height = h;
    }
    if (betterUrl && (betterDims || area >= curUrlArea)) {
      url = candidateUrl;
    }
  };

  apply(fromOriginal.width, fromOriginal.height);
  apply(fromStp.width, fromStp.height);
  if (best) apply(best.width, best.height, best.url);

  const assetKey = mediaAssetKey(media.url);
  if (assetKey && isLowResDeliveryUrl(url)) {
    const alternates = scrapeAssetUrlsFromHtml(html, assetKey);
    const better = alternates
      .filter((u) => !isLowResDeliveryUrl(u))
      .map((u) => ({ url: u, ...dimensionsFromImageUrl(u) }))
      .filter((c) => c.width && c.height)
      .sort((a, b) => b.width! * b.height! - a.width! * a.height!)[0];
    if (better) apply(better.width, better.height, better.url);
  }

  if ((!width || !height) && fromStp.width && fromStp.height) {
    width = fromStp.width;
    height = fromStp.height;
  }

  if (!isValidMediaUrl(url)) {
    url = media.url;
  }

  return { ...media, url, width, height };
}

export function applyPageHtmlToMedia(media: Media[], html: string): Media[] {
  const images = media.filter((m) => m.type === "image");
  // Carousel: do not run per-slide URL upgrade — HTML scrape picks one "best" URL for all slides.
  if (images.length > 1) {
    return media.map((m) => {
      if (m.type !== "image") return m;
      const dims = dimensionsFromImageUrl(m.url);
      return {
        ...m,
        width: m.width ?? dims.width,
        height: m.height ?? dims.height,
      };
    });
  }
  return media.map((m) => (m.type === "image" ? enrichImageDimensions(m, html) : m));
}

export function mediaArea(m: Media): number {
  return (m.width ?? 0) * (m.height ?? 0);
}

export function imageNeedsDimensions(media: Media[]): boolean {
  const img = media.find((m) => m.type === "image");
  return Boolean(img && (!img.width || !img.height));
}

/** True when metadata says full-size but CDN URL is still a 640-class delivery variant. */
export function imageNeedsHigherResolution(media: Media[]): boolean {
  const img = media.find((m) => m.type === "image");
  if (!img) return false;
  if (!isLowResDeliveryUrl(img.url)) return false;
  const area = (img.width ?? 0) * (img.height ?? 0);
  if (area > 640 * 640) return true;
  const fromStp = dimensionsFromImageUrl(img.url);
  return ((fromStp.width ?? 0) * (fromStp.height ?? 0)) > 640 * 640;
}

/** Fetch embed when dimensions are missing or CDN URL is still a 640-class delivery variant. */
export function postNeedsEmbedFetch(media: Media[]): boolean {
  return imageNeedsDimensions(media) || imageNeedsHigherResolution(media);
}