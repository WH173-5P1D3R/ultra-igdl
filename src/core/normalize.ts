import * as cheerio from "cheerio";
import type {
  ExtractedPostData,
  ParsedUrl,
  Engagement,
  ResultTag,
  Media,
} from "../types/index.js";
import { buildEngagementTags } from "../utils/engagement-tags.js";
import { applyPageHtmlToMedia, mediaArea } from "../utils/media-dimensions.js";
import {
  parseInstagramDescription,
  parseInstagramTitle,
} from "../utils/engagement.js";
import {
  normalizeCaptionText,
  normalizePostCaptionText,
  resolveCaptionForContent,
  scrapeCaptionFromHtml,
} from "../utils/caption.js";
import {
  upgradeMediaItem,
  isStoryProfileImage,
  dimensionsFromImageUrl,
  isValidThumbnailUrl,
  filterValidMedia,
} from "../utils/media-quality.js";
import { pickBestImage, pickBestVideo, decodeHtmlEntities } from "./parser.js";
import { pickPostMedia } from "../utils/post-carousel.js";

export interface PageMeta {
  ogDescription?: string;
  ogTitle?: string;
  html?: string;
  /** Caption from /embed/captioned/ (Instagram UI text). */
  embedCaption?: string;
}

function pickBestMedia(
  media: Media[],
  contentType: ParsedUrl["type"],
  pageHtml = ""
): Media[] {
  const videos = media.filter((m) => m.type === "video");
  const images = media.filter((m) => m.type === "image");

  const preferVideo = contentType === "highlight" || contentType === "story";

  const thumbUrl = (video: Media, fallback?: Media | null) => {
    if (isValidThumbnailUrl(video.thumbnail)) return video.thumbnail;
    if (fallback) {
      const upgraded = upgradeMediaItem(fallback, pageHtml).url;
      return isValidThumbnailUrl(upgraded) ? upgraded : undefined;
    }
    return undefined;
  };

  const isReelOrTv = contentType === "reel" || contentType === "tv";

  const bestVideo = pickBestVideo(videos);
  if (bestVideo && (preferVideo || isReelOrTv)) {
    const thumb = pickBestImage(images);
    return [{ ...bestVideo, thumbnail: thumbUrl(bestVideo, thumb) }];
  }

  // Reels/TV must expose video — never return a poster/thumbnail as primary media.
  if (isReelOrTv) {
    return bestVideo ? [bestVideo] : [];
  }

  if (contentType === "post") {
    if (!images.length) return bestVideo ? [bestVideo] : [];
    return pickPostMedia(media, pageHtml);
  }

  if (!images.length) return bestVideo ? [bestVideo] : [];

  const enriched = images.map((m) => upgradeMediaItem(m, pageHtml));
  const sorted = [...enriched].sort((a, b) => mediaArea(b) - mediaArea(a));
  const bestImage = sorted[0] ?? pickBestImage(enriched);
  return bestImage ? [bestImage] : [];
}

/** OG meta parse (cheerio handles multiline attribute values). */
export function extractPageMeta(html: string): PageMeta {
  if (!html) return {};
  const $ = cheerio.load(html);
  const ogDescription = decodeHtmlEntities(
    $('meta[property="og:description"]').attr("content") ?? ""
  );
  const ogTitle = decodeHtmlEntities($('meta[property="og:title"]').attr("content") ?? "");
  return { ogDescription, ogTitle };
}

export function normalizeExtraction(
  data: ExtractedPostData | null,
  parsed: ParsedUrl,
  pageMeta: PageMeta = {},
  pageHtml = ""
): ExtractedPostData | null {
  if (!data) return null;

  data = { ...data, media: filterValidMedia(data.media) };
  if (!data.media.length && !data.isPrivate) return null;

  const html = pageMeta.html ?? pageHtml;
  const scrapedCaption = scrapeCaptionFromHtml(html);
  let ogCaption = "";
  let username = data.username;
  let engagement: Engagement = data.engagement ?? {};

  if (pageMeta.ogDescription) {
    const parsedDesc = parseInstagramDescription(pageMeta.ogDescription);
    ogCaption = parsedDesc.caption;
    if (parsedDesc.username) username = parsedDesc.username;
    engagement = { ...engagement, ...parsedDesc.engagement };
  }

  let caption = resolveCaptionForContent(parsed.type, {
    embed: pageMeta.embedCaption,
    scraped: scrapedCaption,
    extracted: data.caption,
    og: ogCaption,
  });

  if (pageMeta.ogTitle) {
    const fromTitle = parseInstagramTitle(pageMeta.ogTitle);
    if (fromTitle.username && !username) {
      username = fromTitle.username;
    }
    if (fromTitle.caption) {
      caption =
        parsed.type === "highlight"
          ? normalizeCaptionText(fromTitle.caption) || caption
          : resolveCaptionForContent(parsed.type, {
              embed: pageMeta.embedCaption,
              scraped: scrapedCaption,
              extracted: caption,
              og: fromTitle.caption,
            });
    }
  }

  if (parsed.type === "story") {
    if (parsed.username) username = parsed.username;
    if (/^\d[\d.KMB,\s]*(?:likes?|comments?|views?)/i.test(caption)) {
      const parsedDesc = parseInstagramDescription(caption);
      caption = parsedDesc.caption;
      engagement = { ...engagement, ...parsedDesc.engagement };
    }
    data.media = data.media.filter((m) => !isStoryProfileImage(m.url));
  }

  if (parsed.username && (parsed.type === "story" || parsed.type === "highlight")) {
    username = parsed.username;
  }

  const skipHtmlEnrich = !html && (parsed.type === "story" || parsed.type === "highlight");
  const enrichedMedia = (skipHtmlEnrich ? data.media : applyPageHtmlToMedia(data.media, html)).map(
    (m) => {
    if (m.type !== "image" || (m.width && m.height)) return m;
    const dims = dimensionsFromImageUrl(m.url);
    if (!dims.width || !dims.height) return m;
    return { ...m, width: dims.width, height: dims.height };
  });
  const media = pickBestMedia(enrichedMedia, parsed.type, html);

  const tags = [
    ...new Set<ResultTag>([
      ...(data.tags ?? []),
      ...buildEngagementTags(parsed.type, pageMeta.ogDescription, engagement, html),
    ]),
  ];
  if (tags.includes("likes_hidden")) engagement.likesHidden = true;
  if (tags.includes("comments_hidden")) engagement.commentsHidden = true;

  const hasEngagementMetrics =
    engagement.likes != null ||
    engagement.comments != null ||
    engagement.views != null ||
    engagement.shares != null ||
    Boolean(engagement.raw);
  const hasEngagement =
    hasEngagementMetrics || engagement.likesHidden || engagement.commentsHidden;

  return {
    ...data,
    media,
    caption:
      parsed.type === "post" ? normalizePostCaptionText(caption) : normalizeCaptionText(caption),
    username: username.replace(/^@/, "").trim(),
    engagement: hasEngagement ? engagement : undefined,
    tags: tags.length ? tags : undefined,
  };
}