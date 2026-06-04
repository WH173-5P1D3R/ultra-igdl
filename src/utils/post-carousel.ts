import type { Media } from "../types/index.js";
import { mediaArea } from "./media-dimensions.js";
import { upgradeMediaItem } from "./media-quality.js";
import { pickBestImage } from "../core/parser.js";

function imageQualityScore(item: Media): number {
  const area = mediaArea(item);
  if (area > 0) return area;
  return item.width ?? 0;
}

function encodeTagFromUrl(url: string): string | null {
  const raw = url.match(/[?&]efg=([^&]+)/i)?.[1];
  if (!raw) return null;
  try {
    const b64 = decodeURIComponent(raw);
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      encode_tag?: string;
      vencode_tag?: string;
      efg_tag?: string;
    };
    return json.encode_tag ?? json.vencode_tag ?? json.efg_tag ?? null;
  } catch {
    return null;
  }
}

/** OG/HTML carousel preview — not a real sidecar slide (e.g. CAROUSEL_BEST_IMAGE_URLGEN). */
export function isCarouselAuxiliaryImage(url: string): boolean {
  if (/CAROUSEL_BEST_IMAGE|best_image_urlgen|cover_photo/i.test(url)) return true;
  const tag = encodeTagFromUrl(url);
  if (tag && /BEST_IMAGE|COVER|THUMBNAIL/i.test(tag)) return true;
  return false;
}

export function stripCarouselAuxiliaryImages(media: Media[]): Media[] {
  return media.filter((m) => m.type !== "image" || !isCarouselAuxiliaryImage(m.url));
}

/** Stable key per carousel slide (groups resolution variants of the same photo). */
export function slideKeyFromMediaUrl(url: string): string {
  const cacheKey = url.match(/ig_cache_key=([^&]+)/i)?.[1];
  if (cacheKey) {
    try {
      return `ck:${decodeURIComponent(cacheKey)}`;
    } catch {
      return `ck:${cacheKey}`;
    }
  }
  const base = (url.split("?")[0] ?? url).replace(/\\/g, "");
  const fileId = base.match(/\/(\d{8,12})_(\d{10,})_\d+_n\./i);
  if (fileId) return `file:${fileId[1]}_${fileId[2]}`;
  const idMatch = base.match(/\/(\d{11,})(?:_\d+)?[_/]/);
  if (idMatch) return `id:${idMatch[1]}`;
  return base.replace(/_s\d+x\d+/gi, "").replace(/p\d+x\d+/gi, "");
}

/** One image per slide (largest resolution); preserve order; keep all videos. */
export function dedupePostSlides(media: Media[]): Media[] {
  if (media.length <= 1) return media;

  const bestByKey = new Map<string, Media>();
  for (const item of media) {
    if (item.type !== "image") continue;
    const key = slideKeyFromMediaUrl(item.url);
    const prev = bestByKey.get(key);
    if (!prev || imageQualityScore(item) > imageQualityScore(prev)) bestByKey.set(key, item);
  }

  const out: Media[] = [];
  const usedImageKeys = new Set<string>();

  for (const item of media) {
    if (item.type === "video") {
      out.push(item);
      continue;
    }
    const key = slideKeyFromMediaUrl(item.url);
    if (usedImageKeys.has(key)) continue;
    usedImageKeys.add(key);
    out.push(bestByKey.get(key) ?? item);
  }

  return out.length ? out : media;
}

/** All carousel slides for posts (1, 2, or more photos/videos). */
export function pickPostMedia(media: Media[], pageHtml = ""): Media[] {
  const filtered = stripCarouselAuxiliaryImages(media);
  const imageCount = filtered.filter((m) => m.type === "image").length;
  const upgraded = filtered.map((m) => {
    if (m.type !== "image") return m;
    return imageCount > 1 ? upgradeMediaItem(m) : upgradeMediaItem(m, pageHtml);
  });
  const slides = dedupePostSlides(upgraded);

  if (slides.length <= 1) {
    const only = slides[0];
    if (!only) return [];
    if (only.type === "video") return [only];
    return [pickBestImage(upgraded) ?? only];
  }

  return slides;
}