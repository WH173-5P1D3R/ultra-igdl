import type { Engagement } from "../types/index.js";
import { normalizeCaptionText } from "./caption-normalize.js";

/** Normalize Instagram curly/smart quotes for caption extraction. */
export function normalizeInstagramQuotes(raw: string): string {
  return raw
    .replace(/[\u201c\u201d\u201e\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .trim();
}

function parseCount(token: string): number | undefined {
  const m = token.trim().match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return undefined;
  let n = parseFloat(m[1]!);
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "K") n *= 1000;
  else if (suffix === "M") n *= 1_000_000;
  else if (suffix === "B") n *= 1_000_000_000;
  return Math.round(n);
}

export function extractEngagementCounts(statsSegment: string): Engagement {
  const engagement: Engagement = {};
  const likes = statsSegment.match(/([\d.]+[KMB]?)\s+likes?/i);
  const comments = statsSegment.match(/([\d.]+[KMB]?)\s+comments?/i);
  const views = statsSegment.match(/([\d.]+[KMB]?)\s+views?/i);
  const shares = statsSegment.match(/([\d.]+[KMB]?)\s+shares?/i);

  if (likes) engagement.likes = parseCount(likes[1]!);
  if (comments) engagement.comments = parseCount(comments[1]!);
  if (views) engagement.views = parseCount(views[1]!);
  if (shares) engagement.shares = parseCount(shares[1]!);

  return engagement;
}

export interface ParsedCaptionMeta {
  caption: string;
  username: string;
  engagement: Engagement;
}

/** Split og:description into engagement stats vs original caption. */
export function parseInstagramDescription(raw: string): ParsedCaptionMeta {
  const text = normalizeInstagramQuotes(raw);
  const engagement: Engagement = {};
  let caption = text;
  let username = "";

  const quoted = text.match(
    /^([\d\s,KMB.likescommentsviews]+?)\s*-\s*@?([\w.]+)\s+on\s+[\s\S]+?:\s*["']([\s\S]+)["']\s*\.?\s*$/i
  );
  if (quoted) {
    Object.assign(engagement, extractEngagementCounts(quoted[1]!));
    username = quoted[2]!;
    caption = normalizeCaptionText(quoted[3]!.trim());
    return { caption, username, engagement };
  }

  const colonBody = text.match(
    /^([\d\s,KMB.likescommentsviews]+?)\s*-\s*@?([\w.]+)\s+on\s+([^:]+):\s*([\s\S]+)\s*$/i
  );
  if (colonBody) {
    Object.assign(engagement, extractEngagementCounts(colonBody[1]!));
    username = colonBody[2]!;
    caption = normalizeCaptionText(
      colonBody[4]!
        .replace(/^["']|["']$/g, "")
        .replace(/\s*\.\s*$/, "")
        .trim()
    );
    return { caption, username, engagement };
  }

  if (
    !/\s+on\s+[\w\s\d,]+:\s*/i.test(text) &&
    /^\d[\d.KMB,\s]*(?:likes?|comments?|views?)/i.test(text)
  ) {
    Object.assign(engagement, extractEngagementCounts(text));
    caption = "";
    engagement.raw = text;
  }

  return { caption, username, engagement };
}

export function parseInstagramTitle(raw: string): { username: string; caption: string } {
  const text = raw.trim();
  let username = "";
  let caption = "";

  const highlight = text.match(/^(.+?)\s*=\s*@([\w.]+)/);
  if (highlight) {
    caption = highlight[1]!.trim();
    username = highlight[2]!;
    return { username, caption };
  }

  const paren = text.match(/\(@([\w.]+)\)/);
  if (paren) username = paren[1]!;

  const reel = text.match(/^(.+?)\s*\(@([\w.]+)\)\s*•/);
  if (reel) {
    caption = "";
    username = reel[2]!;
    return { username, caption };
  }

  const onIg = text.match(/^(.+?)\s+on Instagram/i);
  if (onIg && !text.toLowerCase().includes("watch this story")) {
    const part = onIg[1]!.trim();
    const at = part.match(/@([\w.]+)/);
    if (at) username = at[1]!;
    else caption = part;
  }

  const atOnly = text.match(/@([\w.]+)/);
  if (!username && atOnly) username = atOnly[1]!;

  return { username, caption };
}