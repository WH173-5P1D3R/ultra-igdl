import type { Engagement, ParsedUrl } from "../types/index.js";
import type { EngagementTag } from "../types/index.js";

/** OG line starts with "12K likes, …" when counts are public. */
export function ogDescriptionHasPublicCounts(ogDescription: string): boolean {
  return /^\d[\d.KMB,\s]*(?:likes?|comments?|views?)/i.test(ogDescription.trim());
}

/** Creator hid like/view counts in embedded JSON. */
export function scrapeEngagementFlagsFromHtml(html: string): {
  likesHidden: boolean;
  commentsHidden: boolean;
} {
  let likesHidden = false;
  let commentsHidden = false;
  if (!html) return { likesHidden, commentsHidden };

  if (
    /like_and_view_counts_disabled":\s*true/i.test(html) ||
    /"hide_like_and_view_counts":\s*true/i.test(html)
  ) {
    likesHidden = true;
  }
  if (/comments_disabled":\s*true/i.test(html)) {
    commentsHidden = true;
  }
  return { likesHidden, commentsHidden };
}

export function engagementFromApiItem(item: Record<string, unknown>): Engagement | undefined {
  const engagement: Engagement = {};

  if (typeof item.like_count === "number") engagement.likes = item.like_count;
  if (typeof item.comment_count === "number") engagement.comments = item.comment_count;
  if (typeof item.view_count === "number") engagement.views = item.view_count;
  if (typeof item.play_count === "number" && engagement.views == null) {
    engagement.views = item.play_count;
  }

  if (item.like_and_view_counts_disabled === true) {
    engagement.likesHidden = true;
  }
  if (item.comments_disabled === true) {
    engagement.commentsHidden = true;
  }

  const hasMetric =
    engagement.likes != null ||
    engagement.comments != null ||
    engagement.views != null;
  const hasFlags = engagement.likesHidden || engagement.commentsHidden;

  return hasMetric || hasFlags ? engagement : undefined;
}

export function buildEngagementTags(
  parsedType: ParsedUrl["type"],
  ogDescription: string | undefined,
  engagement: Engagement,
  html: string
): EngagementTag[] {
  const tags = new Set<EngagementTag>();
  const countable = parsedType === "reel" || parsedType === "post" || parsedType === "tv";

  if (engagement.likesHidden) tags.add("likes_hidden");
  if (engagement.commentsHidden) tags.add("comments_hidden");

  const fromHtml = scrapeEngagementFlagsFromHtml(html);
  if (fromHtml.likesHidden) tags.add("likes_hidden");
  if (fromHtml.commentsHidden) tags.add("comments_hidden");

  if (!countable || !ogDescription?.trim()) {
    return [...tags];
  }

  const publicCounts = ogDescriptionHasPublicCounts(ogDescription);
  const captionOnlyOg = /\bon\s+[\w\s\d,.]+:\s*["']/i.test(ogDescription);

  if (captionOnlyOg && !publicCounts) {
    if (engagement.likes == null) tags.add("likes_hidden");
    if (engagement.comments == null) tags.add("comments_hidden");
  }

  if (tags.has("likes_hidden") && tags.has("comments_hidden")) {
    tags.add("engagement_hidden");
  }

  return [...tags];
}