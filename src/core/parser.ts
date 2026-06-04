import * as cheerio from "cheerio";
import type { ResultTag, Media, ExtractedPostData } from "../types/index.js";
import { pickBestCaption } from "../utils/caption.js";
import { normalizeCaptionText } from "../utils/caption-normalize.js";
import { logger } from "../utils/logger.js";

type LayerResult = ExtractedPostData | null;

function area(w?: number, h?: number): number {
  return (w ?? 0) * (h ?? 0);
}

export function pickBestImage(candidates: Media[]): Media | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) =>
    area(cur.width, cur.height) > area(best.width, best.height) ? cur : best
  );
}

export function pickBestVideo(candidates: Media[]): Media | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) => {
    const bestScore = area(best.width, best.height) + (best.duration ?? 0);
    const curScore = area(cur.width, cur.height) + (cur.duration ?? 0);
    return curScore > bestScore ? cur : best;
  });
}

export function decodeEscapedUrl(url: string): string {
  let decoded = url
    .replace(/\\u0026/g, "&")
    .replace(/\\u00253D/g, "=")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/&amp;/g, "&");

  while (decoded.includes("\\/") || decoded.includes("\\\\")) {
    decoded = decoded.replace(/\\+\//g, "/").replace(/\\\\/g, "\\");
  }
  decoded = decoded.replace(/\\+$/, "").replace(/\\/g, "");

  if (decoded.startsWith("https:/") && !decoded.startsWith("https://")) {
    decoded = decoded.replace("https:/", "https://");
  }
  return decoded;
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function isProfileOrStaticCdn(url: string): boolean {
  return (
    url.includes("static.cdninstagram.com") ||
    /\/t51\.2885-19\//.test(url) ||
    /stp=dst-jpg_s\d+x\d+/.test(url)
  );
}

function extractJsonLd(html: string): LayerResult {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw) as Record<string, unknown>;
      const items = Array.isArray(data) ? data : [data];
      const media: Media[] = [];
      let caption = "";
      let username = "";

      for (const item of items) {
        if (typeof item !== "object" || !item) continue;
        const obj = item as Record<string, unknown>;

        if (typeof obj.description === "string") {
          caption = pickBestCaption(caption, obj.description);
        }
        if (typeof obj.author === "object" && obj.author) {
          const author = obj.author as Record<string, unknown>;
          if (typeof author.name === "string") username = author.name;
          if (typeof author.identifier === "string") {
            username = author.identifier.replace(/^@/, "");
          }
        }

        const contentUrl = obj.contentUrl ?? obj.embedUrl;
        if (typeof contentUrl === "string") {
          const isVideo =
            obj["@type"] === "VideoObject" ||
            String(contentUrl).includes(".mp4");
          media.push({
            type: isVideo ? "video" : "image",
            url: decodeEscapedUrl(contentUrl),
            thumbnail:
              typeof obj.thumbnailUrl === "string"
                ? decodeEscapedUrl(obj.thumbnailUrl)
                : undefined,
            width: typeof obj.width === "number" ? obj.width : undefined,
            height: typeof obj.height === "number" ? obj.height : undefined,
            duration:
              typeof obj.duration === "string"
                ? parseDuration(obj.duration)
                : undefined,
          });
        }

        if (Array.isArray(obj.image)) {
          for (const img of obj.image) {
            if (typeof img === "string") {
              media.push({ type: "image", url: decodeEscapedUrl(img) });
            } else if (img && typeof img === "object") {
              const im = img as Record<string, unknown>;
              if (typeof im.url === "string") {
                media.push({
                  type: "image",
                  url: decodeEscapedUrl(im.url),
                  width: typeof im.width === "number" ? im.width : undefined,
                  height: typeof im.height === "number" ? im.height : undefined,
                });
              }
            }
          }
        } else if (typeof obj.image === "string") {
          media.push({ type: "image", url: decodeEscapedUrl(obj.image) });
        }
      }

      if (media.length) {
        logger.debug("Layer 1 (JSON-LD) succeeded");
        return { media: dedupeMedia(media), caption, username };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseDuration(iso: string): number | undefined {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

function extractWindowJson(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const start = html.indexOf("{", idx + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function mediaFromNode(node: Record<string, unknown>): Media[] {
  const results: Media[] = [];
  const isVideo = node.is_video === true || node.media_type === 2 || node.__typename === "GraphVideo";

  if (isVideo && node.video_versions) {
    const versions = node.video_versions as Array<Record<string, unknown>>;
    const best = versions.reduce((a, b) =>
      ((b.width as number) ?? 0) > ((a.width as number) ?? 0) ? b : a
    );
    if (typeof best.url === "string") {
      results.push({
        type: "video",
        url: decodeEscapedUrl(best.url),
        width: best.width as number | undefined,
        height: best.height as number | undefined,
        duration: (node.video_duration ?? node.duration) as number | undefined,
        thumbnail: extractThumbnail(node),
      });
    }
  } else if (node.image_versions2) {
    const candidates = (node.image_versions2 as Record<string, unknown>).candidates as
      | Array<Record<string, unknown>>
      | undefined;
    if (candidates?.length) {
      const best = candidates.reduce((a, b) =>
        ((b.width as number) ?? 0) > ((a.width as number) ?? 0) ? b : a
      );
      if (typeof best.url === "string") {
        results.push({
          type: "image",
          url: decodeEscapedUrl(best.url),
          width: best.width as number | undefined,
          height: best.height as number | undefined,
        });
      }
    }
  } else if (node.display_url) {
    results.push({
      type: "image",
      url: decodeEscapedUrl(String(node.display_url)),
      width: node.original_width as number | undefined,
      height: node.original_height as number | undefined,
    });
  } else if (node.display_resources) {
    const resources = node.display_resources as Array<Record<string, unknown>>;
    const best = resources.reduce((a, b) =>
      ((b.config_width as number) ?? 0) > ((a.config_width as number) ?? 0) ? b : a
    );
    if (typeof best.src === "string") {
      results.push({
        type: "image",
        url: decodeEscapedUrl(best.src),
        width: best.config_width as number | undefined,
        height: best.config_height as number | undefined,
      });
    }
  }

  return results;
}

function extractThumbnail(node: Record<string, unknown>): string | undefined {
  if (typeof node.thumbnail_src === "string") return decodeEscapedUrl(node.thumbnail_src);
  const candidates = (node.image_versions2 as Record<string, unknown> | undefined)
    ?.candidates as Array<Record<string, unknown>> | undefined;
  if (candidates?.[0] && typeof candidates[0].url === "string") {
    return decodeEscapedUrl(candidates[0].url);
  }
  return undefined;
}

function walkForMedia(obj: unknown, media: Media[], meta: { caption: string; username: string }): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) walkForMedia(item, media, meta);
    return;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.caption === "object" && record.caption) {
    const cap = record.caption as Record<string, unknown>;
    if (typeof cap.text === "string") {
      meta.caption = pickBestCaption(meta.caption, normalizeCaptionText(cap.text));
    }
  } else if (typeof record.edge_media_to_caption === "object") {
    const edges = (record.edge_media_to_caption as Record<string, unknown>).edges as
      | Array<Record<string, unknown>>
      | undefined;
    const text = edges?.[0]?.node as Record<string, unknown> | undefined;
    if (typeof text?.text === "string") {
      meta.caption = pickBestCaption(meta.caption, normalizeCaptionText(text.text));
    }
  }

  if (typeof record.owner === "object" && record.owner) {
    const owner = record.owner as Record<string, unknown>;
    if (typeof owner.username === "string") meta.username = owner.username;
  }

  const carouselSlides: Record<string, unknown>[] = [];
  if (Array.isArray(record.carousel_media)) {
    for (const item of record.carousel_media) {
      if (item && typeof item === "object") {
        carouselSlides.push(item as Record<string, unknown>);
      }
    }
  }
  if (record.edge_sidecar_to_children) {
    const edges = (record.edge_sidecar_to_children as Record<string, unknown>).edges as
      | Array<Record<string, unknown>>
      | undefined;
    for (const edge of edges ?? []) {
      const node = edge.node as Record<string, unknown> | undefined;
      if (node) carouselSlides.push(node);
    }
  }

  if (carouselSlides.length > 0) {
    for (const slide of carouselSlides) {
      media.push(...mediaFromNode(slide));
    }
  } else if (
    record.shortcode ||
    record.display_url ||
    record.video_versions ||
    record.image_versions2 ||
    record.is_video !== undefined
  ) {
    media.push(...mediaFromNode(record));
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "carousel_media" || key === "edge_sidecar_to_children") continue;
    if (value && typeof value === "object") walkForMedia(value, media, meta);
  }
}

function extractAdditionalData(html: string): LayerResult {
  const data = extractWindowJson(html, "window.__additionalDataLoaded(");
  if (!data) return null;
  const media: Media[] = [];
  const meta = { caption: "", username: "" };
  walkForMedia(data, media, meta);
  if (media.length) {
    logger.debug("Layer 2 (__additionalDataLoaded) succeeded");
    return { media: dedupeMedia(media), caption: meta.caption, username: meta.username };
  }
  return null;
}

function extractSharedData(html: string): LayerResult {
  const data = extractWindowJson(html, "window._sharedData");
  if (!data) return null;
  const media: Media[] = [];
  const meta = { caption: "", username: "" };
  walkForMedia(data, media, meta);
  if (media.length) {
    logger.debug("Layer 3 (_sharedData) succeeded");
    return { media: dedupeMedia(media), caption: meta.caption, username: meta.username };
  }
  return null;
}

function extractNextData(html: string): LayerResult {
  const $ = cheerio.load(html);
  const script = $("#__NEXT_DATA__").html();
  if (!script) return null;
  try {
    const data = JSON.parse(script);
    const media: Media[] = [];
    const meta = { caption: "", username: "" };
    walkForMedia(data, media, meta);
    if (media.length) {
      logger.debug("Layer 4 (Next.js) succeeded");
      return { media: dedupeMedia(media), caption: meta.caption, username: meta.username };
    }
  } catch {
    return null;
  }
  return null;
}

function extractOpenGraph(html: string): LayerResult {
  const $ = cheerio.load(html);
  const media: Media[] = [];
  let caption = normalizeCaptionText(
    decodeHtmlEntities(
      $('meta[property="og:description"]').attr("content") ??
        $('meta[name="description"]').attr("content") ??
        ""
    )
  );

  const ogTitle = decodeHtmlEntities($('meta[property="og:title"]').attr("content") ?? "");
  let username =
    ogTitle.match(/\(@([^)]+)\)/)?.[1] ??
    ogTitle.split("(@")[1]?.replace(")", "").trim() ??
    "";
  if (!username && ogTitle.includes(" on Instagram")) {
    username = ogTitle.split(" on Instagram")[0]?.replace(/^.*@/, "").trim() ?? "";
  }
  if (!username && ogTitle.includes("@")) {
    const m = ogTitle.match(/@([\w.]+)/);
    if (m) username = m[1]!;
  }

  const ogVideo = decodeHtmlEntities(
    $('meta[property="og:video:secure_url"], meta[property="og:video"]').attr("content") ?? ""
  );
  const ogImage = decodeHtmlEntities(
    $('meta[property="og:image"]').attr("content") ??
      $('meta[property="og:image:url"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      ""
  );

  if (ogVideo) {
    media.push({
      type: "video",
      url: decodeEscapedUrl(ogVideo),
      thumbnail: ogImage ? decodeEscapedUrl(ogImage) : undefined,
    });
  }
  if (ogImage) {
    const imageUrl = decodeEscapedUrl(ogImage);
    const type = imageUrl.includes(".mp4") ? "video" : "image";
    const isThumbForVideo = Boolean(ogVideo) && type === "image";
    if (
      !isThumbForVideo &&
      !media.some((m) => m.url === imageUrl) &&
      (!isProfileOrStaticCdn(imageUrl) || !ogVideo)
    ) {
      media.push({ type, url: imageUrl });
    } else if (ogVideo && imageUrl && !media[0]?.thumbnail) {
      media[0]!.thumbnail = imageUrl;
    }
  }

  if (media.length) {
    logger.debug("Layer 5 (Open Graph) succeeded");
    return { media: dedupeMedia(media), caption, username };
  }
  return null;
}

function extractScriptJson(html: string): LayerResult {
  const $ = cheerio.load(html);
  const media: Media[] = [];
  const meta = { caption: "", username: "" };

  $('script[type="application/json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw || raw.length < 500) return;
    try {
      const data = JSON.parse(raw);
      walkForMedia(data, media, meta);
    } catch {
      /* ignore invalid JSON chunks */
    }
  });

  if (media.length) {
    logger.debug("Layer 5b (application/json scripts) succeeded");
    return { media: dedupeMedia(media), caption: meta.caption, username: meta.username };
  }
  return null;
}

/** Parse Instagram /embed/ pages for video_url fields. */
export function parseEmbedHtml(html: string): ExtractedPostData | null {
  const scriptResult = extractScriptJson(html);
  if (scriptResult?.media.some((m) => m.type === "video")) {
    return scriptResult;
  }

  const media: Media[] = [];
  const patterns = [
    /video_url\\":\\"([^"]+)/g,
    /"video_url":"(https?:[^"]+)"/g,
    /playback_url\\":\\"([^"]+)/g,
    /"playback_url":"(https?:[^"]+)"/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      let url = decodeEscapedUrl(match[1]!);
      if (!url.startsWith("http")) url = `https://${url.replace(/^\/+/, "")}`;
      if (url.includes(".mp4") || url.includes("fbcdn") || url.includes("cdninstagram")) {
        media.push({ type: "video", url });
      }
    }
  }

  if (!media.length) return null;
  return { media: dedupeMedia(media), caption: "", username: "" };
}

function extractDirectCdn(html: string): LayerResult {
  const media: Media[] = [];
  const found = new Set<string>();
  const patterns = [
    /https:\/\/scontent\.cdninstagram\.com\/[^"'\s<>\\&]+/g,
    /https:\\\/\\\/scontent\.cdninstagram\.com\/[^"\\]+/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = decodeEscapedUrl(match[0]!);
      if (isProfileOrStaticCdn(url) || found.has(url)) continue;
      found.add(url);
      const type = url.includes(".mp4") ? "video" : "image";
      media.push({ type, url });
    }
  }

  if (media.length) {
    logger.debug("Layer 6b (direct CDN) succeeded");
    return { media: dedupeMedia(media), caption: "", username: "" };
  }
  return null;
}

function extractGraphQLFromPage(html: string): LayerResult {
  const docIdMatch = html.match(/"doc_id":"(\d+)"/);
  const queryIdMatch = html.match(/"query_id":"(\d+)"/);
  if (!docIdMatch && !queryIdMatch) return null;

  const media: Media[] = [];
  const cdnPatterns = [
    /"video_url":"([^"]+)"/g,
    /"display_url":"([^"]+)"/g,
    /"url":"(https:\\\/\\\/[^"]+?cdninstagram[^"]+)"/g,
  ];

  for (const pattern of cdnPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = decodeEscapedUrl(match[1]!);
      if (url.includes(".mp4") || url.includes("video")) {
        media.push({ type: "video", url });
      } else if (url.includes("cdninstagram") || url.includes("fbcdn")) {
        media.push({ type: "image", url });
      }
    }
  }

  if (media.length) {
    logger.debug("Layer 6 (GraphQL discovery) succeeded");
    return { media: dedupeMedia(media), caption: "", username: "" };
  }
  return null;
}

function extractFallback(html: string): LayerResult {
  const media: Media[] = [];
  const videoRegex =
    /"video_versions":\s*\[([^\]]+)\]/g;
  const urlRegex = /"url":"(https?:\\\/\\\/[^"]+)"/g;

  let block: RegExpExecArray | null;
  while ((block = videoRegex.exec(html)) !== null) {
    const segment = block[1]!;
    const urls: Array<{ url: string; width: number }> = [];
    let m: RegExpExecArray | null;
    const inner = /"url":"([^"]+)","width":(\d+)/g;
    while ((m = inner.exec(segment)) !== null) {
      urls.push({ url: decodeEscapedUrl(m[1]!), width: parseInt(m[2]!, 10) });
    }
    if (urls.length) {
      const best = urls.reduce((a, b) => (b.width > a.width ? b : a));
      media.push({ type: "video", url: best.url, width: best.width });
    }
  }

  const imageCandidates: Array<{ url: string; width: number }> = [];
  const imgRegex = /"display_url":"([^"]+)"|"src":"(https?:\\\/\\\/[^"]+?)"/g;
  let im: RegExpExecArray | null;
  while ((im = imgRegex.exec(html)) !== null) {
    const url = decodeEscapedUrl(im[1] ?? im[2]!);
    if (url.includes("cdninstagram") || url.includes("fbcdn")) {
      imageCandidates.push({ url, width: 0 });
    }
  }

  const configRegex =
    /"src":"(https?:\\\/\\\/[^"]+)","config_width":(\d+)/g;
  while ((im = configRegex.exec(html)) !== null) {
    imageCandidates.push({
      url: decodeEscapedUrl(im[1]!),
      width: parseInt(im[2]!, 10),
    });
  }

  if (imageCandidates.length) {
    const best = imageCandidates.reduce((a, b) => (b.width > a.width ? b : a));
    if (!media.some((m) => m.url === best.url)) {
      media.push({ type: "image", url: best.url, width: best.width || undefined });
    }
  }

  if (!media.length) {
    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(html)) !== null) {
      const url = decodeEscapedUrl(m[1]!);
      if (url.includes(".mp4")) media.push({ type: "video", url });
      else if (url.includes("cdninstagram")) media.push({ type: "image", url });
    }
  }

  if (media.length) {
    logger.debug("Layer 7 (fallback) succeeded");
    return { media: dedupeMedia(media), caption: "", username: "" };
  }
  return null;
}

function dedupeMedia(media: Media[]): Media[] {
  const seen = new Set<string>();
  const result: Media[] = [];
  for (const item of media) {
    const normalized = item.url.split("?")[0]!;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (!item.url.startsWith("http")) continue;
    if (item.url.includes("static.cdninstagram.com")) continue;
    result.push(item);
  }
  return result.map((m) => ({
    ...m,
    url: decodeEscapedUrl(m.url),
  }));
}

export function mergeExtracted(
  primary: ExtractedPostData | null,
  secondary: ExtractedPostData | null
): ExtractedPostData | null {
  if (!primary && !secondary) return null;
  if (!primary) return secondary;
  if (!secondary) return primary;

  const media = dedupeMedia([...primary.media, ...secondary.media]);
  const tags = [...new Set<ResultTag>([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
  return {
    media,
    caption: pickBestCaption(primary.caption, secondary.caption),
    username: primary.username || secondary.username,
    engagement:
      primary.engagement || secondary.engagement
        ? { ...secondary.engagement, ...primary.engagement }
        : undefined,
    tags: tags.length ? tags : undefined,
    isPrivate: primary.isPrivate || secondary.isPrivate,
  };
}

export function needsVideoEmbedFallback(
  parsed: { type: string },
  data: ExtractedPostData | null
): boolean {
  if (!data?.media.length) return parsed.type === "reel" || parsed.type === "tv";
  if (parsed.type !== "reel" && parsed.type !== "tv") return false;
  return !data.media.some((m) => m.type === "video");
}

function extractionComplete(
  data: ExtractedPostData,
  contentType?: string
): boolean {
  if (data.media.some((m) => m.type === "video")) return true;
  if (contentType === "post") {
    const img = data.media.find((m) => m.type === "image");
    if (!img) return false;
    if (img.width && img.height && img.width > 640) return true;
    const fromUrl = img.url.match(/stp=c[\d.]+?\.(\d+)\.(\d+)a/i);
    if (fromUrl) {
      const w = parseInt(fromUrl[1]!, 10);
      return w > 640;
    }
    return false;
  }
  if (contentType === "reel" || contentType === "tv") {
    return data.media.some((m) => m.type === "video");
  }
  return data.media.length > 0;
}

export function parseHtml(
  html: string,
  contentType?: string
): ExtractedPostData | null {
  const fast =
    contentType === "post" ||
    contentType === "reel" ||
    contentType === "tv" ||
    contentType === "highlight" ||
    contentType === "story";

  const layers = fast
    ? [
        extractOpenGraph,
        extractScriptJson,
        extractAdditionalData,
        extractSharedData,
        extractFallback,
      ]
    : [
        extractScriptJson,
        extractJsonLd,
        extractAdditionalData,
        extractSharedData,
        extractNextData,
        extractOpenGraph,
        extractGraphQLFromPage,
        extractDirectCdn,
        extractFallback,
      ];

  let merged: ExtractedPostData | null = null;
  for (const layer of layers) {
    const result = layer(html);
    if (result?.media.length) {
      merged = mergeExtracted(merged, result);
      // Posts may be carousels — keep scanning after OG returns a single image.
      if (
        fast &&
        contentType !== "post" &&
        merged &&
        extractionComplete(merged, contentType)
      ) {
        break;
      }
    }
  }

  if (merged?.media.length) {
    return upgradeMediaQuality(merged);
  }

  if (html.includes("login") && html.includes("Log in to Instagram")) {
    return { media: [], caption: "", username: "", isPrivate: true };
  }

  return null;
}

function upgradeMediaQuality(data: ExtractedPostData): ExtractedPostData {
  const videos = data.media.filter((m) => m.type === "video");
  const images = data.media.filter((m) => m.type === "image");

  const upgraded: Media[] = [];
  const bestVideo = pickBestVideo(videos);
  if (bestVideo) upgraded.push(bestVideo);
  else if (videos[0]) upgraded.push(videos[0]);

  for (const img of images) {
    if (!upgraded.some((u) => u.url.split("?")[0] === img.url.split("?")[0])) {
      upgraded.push(img);
    }
  }

  if (!bestVideo && images.length > 1) {
    const sorted = [...images].sort(
      (a, b) => area(b.width, b.height) - area(a.width, a.height)
    );
    return { ...data, media: sorted };
  }

  return { ...data, media: upgraded.length ? upgraded : data.media };
}

export function detectRateLimit(html: string): boolean {
  return (
    html.includes("Please wait a few minutes") ||
    html.includes("429 Too Many Requests") ||
    html.includes("rate limit")
  );
}

export function detectNotFound(html: string, statusCode: number): boolean {
  return (
    statusCode === 404 ||
    html.includes("Sorry, this page isn't available") ||
    html.includes("Page Not Found")
  );
}